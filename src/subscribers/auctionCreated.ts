import { Address, Log, decodeEventLog } from "viem";
import {
  BASE_RATIO,
  DEFAULT_DUTCH_AUCTION_POLLING_INTERVAL,
  DEFAULT_DUTCH_AUCTION_STEP_COUNT,
  DUTCH_AUCTION_ACTIVE_INTERVALS,
} from "../constants/values";
import { LeverageToken, RebalanceType } from "../types";
import {
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
  getLeverageTokenRebalanceAdapter,
  rebalancerContract,
} from "../utils/contractHelpers";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { logAndAlert } from "../utils/alerts";
import { publicClient } from "../utils/transactionHelpers";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";

const getLeverageTokenRebalanceData = async (leverageToken: Address, rebalanceAdapter: Address) => {
  const [leverageTokenStateResponse, targetRatioResponse, isAuctionValidResponse] = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
        abi: LeverageManagerAbi,
        functionName: "getLeverageTokenState",
        args: [leverageToken],
      },
      {
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "getLeverageTokenTargetCollateralRatio",
      },
      {
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "isAuctionValid",
      },
    ],
  });

  if (!leverageTokenStateResponse.result || !targetRatioResponse.result || !isAuctionValidResponse.result) {
    console.error("Failed to get leverage token rebalance data");
    throw new Error("Failed to get leverage token rebalance data");
  }

  return {
    collateral: leverageTokenStateResponse.result.collateralInDebtAsset,
    debt: leverageTokenStateResponse.result.debt,
    equity: leverageTokenStateResponse.result.equity,
    currentRatio: leverageTokenStateResponse.result.collateralRatio,
    targetRatio: targetRatioResponse.result,
    isAuctionValid: isAuctionValidResponse.result,
  };
};

const handleAuctionCreatedEvent = async (rebalanceAdapter: Address, event: Log) => {
  try {
    const decodedEvent = decodeEventLog({
      abi: RebalanceAdapterAbi,
      data: event.data,
      topics: event.topics,
    });

    if (decodedEvent.eventName !== "AuctionCreated") {
      console.log("Not an AuctionCreated event. Skipping...");
      return;
    }

    console.log("AuctionCreated event received. Participating in Dutch auction...");

    const leverageToken = getLeverageTokenForRebalanceAdapter(rebalanceAdapter);

    const { collateral, debt, equity, currentRatio, targetRatio, isAuctionValid } = await getLeverageTokenRebalanceData(
      leverageToken,
      rebalanceAdapter
    );

    if (!isAuctionValid) {
      console.log("Auction is not valid. Skipping rebalance...");
      return;
    }

    const isOverCollateralized = currentRatio > targetRatio;

    console.log(`Strategy is ${isOverCollateralized ? "over" : "under"}-collateralized?`);

    const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
    const debtAsset = getLeverageTokenDebtAsset(leverageToken);

    const baseRatio = BASE_RATIO;
    const targetCollateral = (equity * targetRatio) / baseRatio;
    const targetDebt = (equity * (targetRatio - baseRatio)) / baseRatio;

    // Calculate what is max amount to take to bring LT to target debt or target collateral
    // If strategy is over-collateralized we are adding collateral and borrowing debt
    // If strategy is under-collateralized we are repaying debt and removing collateral
    const assetIn = isOverCollateralized ? collateralAsset : debtAsset;
    const assetOut = isOverCollateralized ? debtAsset : collateralAsset;
    const maxAmountToTake = isOverCollateralized ? targetDebt - debt : targetCollateral - collateral;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = Number(process.env.DUTCH_AUCTION_STEP_COUNT) || DEFAULT_DUTCH_AUCTION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    // TODO: Instead of for loop maybe put this in big multicall
    for (let i = 0; i <= stepCount; i++) {
      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);

      const [isAuctionValid, { isProfitable, swapType, swapContext, lifiSwap }] = await Promise.all([
        publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "isAuctionValid",
        }),
        getRebalanceSwapParams({
          leverageToken,
          assetIn,
          assetOut,
          takeAmount,
        }),
      ]);

      if (!isAuctionValid) {
        console.log("Auction is no longer valid. Closing interval...");

        const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
        DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
        clearInterval(interval);

        return;
      }

      if (!isProfitable) {
        console.log("Rebalance is not profitable. Skipping...");
        continue;
      }

      console.log("Rebalance is profitable. Participating in Dutch auction...");
      try {
        const tx = await rebalancerContract.write.takeAuction([
          leverageToken,
          takeAmount,
          RebalanceType.REBALANCE_DOWN,
          {
            swapType,
            swapContext,
            lifiSwap,
          },
        ]);

        console.log(`Auction taken. Transaction hash: ${tx}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        const message =
          receipt.status === "success"
            ? `Rebalance auction taken successfully for LeverageToken: ${leverageToken}. Transaction hash: ${tx}`
            : `Rebalance auction taken but transaction failed for LeverageToken: ${leverageToken}. Transaction hash: ${tx}`;
        await logAndAlert(message, receipt.status !== "success");
      } catch (error) {
        await logAndAlert(`Error taking auction: ${error}`, true);
      }
    }
  } catch (error) {
    console.error("Error handling auction event:", error);
    throw error;
  }
};

export const subscribeToAuctionCreated = (rebalanceAdapter: Address) => {
  console.log(`Listening for AuctionCreated events on RebalanceAdapter ${rebalanceAdapter}...`);

  subscribeToEventWithWebSocket({
    contractAddress: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onEvent: (event: Log) => {
      const pollingInterval =
        Number(process.env.DUTCH_AUCTION_POLLING_INTERVAL) || DEFAULT_DUTCH_AUCTION_POLLING_INTERVAL;

      // Get current Dutch auction interval for this rebalance adapter
      const currentAuctionInterval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);

      // If there is an interval that is already running, clear it because auction has finished and new one started so we should start
      // new interval from max amounts. Interval should close himself but it can happen that it is not closed right away so we need to
      // close it to avoid having multiple intervals running at the same time for the same rebalance adapter.
      if (currentAuctionInterval) {
        clearInterval(currentAuctionInterval);
      }

      const interval = setInterval(async () => {
        await handleAuctionCreatedEvent(rebalanceAdapter, event);
      }, pollingInterval);

      DUTCH_AUCTION_ACTIVE_INTERVALS.set(rebalanceAdapter, interval);
    },
  });
};

export const subscribeToAllAuctionCreatedEvents = () => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    subscribeToAuctionCreated(rebalanceAdapter);
  });
};
