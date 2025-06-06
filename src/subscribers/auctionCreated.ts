import { Address, BaseError, ContractFunctionRevertedError } from "viem";
import {
  BASE_RATIO,
  DUTCH_AUCTION_ACTIVE_INTERVALS,
  DUTCH_AUCTION_POLLING_INTERVAL,
  DUTCH_AUCTION_STEP_COUNT,
} from "../constants/values";
import { getDummySwapParams, getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { LeverageToken, LogLevel, RebalanceType, StakeType } from "../types";
import {
  dutchAuctionRebalancerContract,
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
  getLeverageTokenRebalanceAdapter,
  leverageManagerContract,
} from "../utils/contractHelpers";

import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { getStakeParams } from "../services/routing/getStakeParams";
import { sendAlert } from "../utils/alerts";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { publicClient } from "../utils/transactionHelpers";

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

  if (
    leverageTokenStateResponse?.result == undefined ||
    targetRatioResponse?.result == undefined ||
    isAuctionValidResponse?.result == undefined
  ) {
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

export const handleAuctionCreatedEvent = async (
  leverageToken: Address,
  rebalanceAdapter: Address,
  collateralAsset: Address,
  debtAsset: Address
) => {
  try {
    const { collateral, debt, equity, currentRatio, targetRatio, isAuctionValid } = await getLeverageTokenRebalanceData(
      leverageToken,
      rebalanceAdapter
    );

    if (!isAuctionValid) {
      console.log(`Auction is not valid for LeverageToken ${leverageToken}. Skipping rebalance...`);
      return;
    }

    const isOverCollateralized = currentRatio > targetRatio;

    console.log(
      `Attempting to take for ${isOverCollateralized ? "over" : "under"}-collateralized LeverageToken ${leverageToken}...`
    );

    const baseRatio = BASE_RATIO;
    const targetCollateral = (equity * targetRatio) / (targetRatio - baseRatio);
    const targetDebt = (equity * baseRatio) / (targetRatio - baseRatio);

    // Calculate what is max amount to take to bring LT to target debt or target collateral
    // If strategy is over-collateralized we are adding collateral and borrowing debt
    // If strategy is under-collateralized we are repaying debt and removing collateral
    const assetIn = isOverCollateralized ? collateralAsset : debtAsset;
    const assetOut = isOverCollateralized ? debtAsset : collateralAsset;
    const maxAmountToTake = isOverCollateralized ? targetDebt - debt : targetCollateral - collateral;

    const rebalanceType = isOverCollateralized ? RebalanceType.REBALANCE_DOWN : RebalanceType.REBALANCE_UP;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = DUTCH_AUCTION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    // Determine whether we can use native EtherFi staking for swapping assets
    const stakeType =
      collateralAsset == CONTRACT_ADDRESSES.WEETH && debtAsset == CONTRACT_ADDRESSES.WETH
        ? StakeType.ETHERFI_ETH_WEETH
        : StakeType.NONE;

    // TODO: Instead of for loop maybe put this in big multicall
    for (let i = 0; i < stepCount; i++) {
      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);

      const [requiredAmountIn, isAuctionValid] = await Promise.all([
        publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "getAmountIn",
          args: [takeAmount],
        }),
        publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "isAuctionValid",
        }),
      ]);

      if (!isAuctionValid) {
        console.log(`Auction is no longer valid for LeverageToken ${leverageToken}. Closing interval...`);

        const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
        DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
        clearInterval(interval);

        return;
      }

      const [swapParams, stakeParams] = await Promise.all([
        getRebalanceSwapParams({
          leverageToken,
          assetIn,
          assetOut,
          takeAmount,
          requiredAmountIn,
        }),
        getStakeParams(stakeType, takeAmount, requiredAmountIn),
      ]);

      if (!swapParams.isProfitable && !stakeParams.isProfitable) {
        console.log(
          `Rebalance is not profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} asset: ${assetIn}. Skipping...`
        );
        continue;
      }

      console.log(
        `Rebalance is profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} asset: ${assetIn}. Participating in Dutch auction...`
      );
      try {
        // Prefer staking over swapping, if profitable
        const rebalanceSwapParams = stakeParams.isProfitable ? getDummySwapParams() : swapParams;

        const tx = await dutchAuctionRebalancerContract.write.takeAuction([
          leverageToken,
          takeAmount,
          rebalanceType,
          {
            swapType: rebalanceSwapParams.swapType,
            swapContext: rebalanceSwapParams.swapContext,
            lifiSwap: rebalanceSwapParams.lifiSwap,
          },
          stakeParams.stakeContext,
        ]);

        await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        const { collateralRatio: collateralRatioAfterRebalance } =
          await leverageManagerContract.read.getLeverageTokenState([leverageToken]);

        console.log(
          `Rebalance auction taken successfully. LeverageToken: ${leverageToken}, New collateral ratio: ${collateralRatioAfterRebalance}, Transaction hash: ${tx}`
        );
        await sendAlert(
          `*Rebalance auction taken successfully*\n• LeverageToken: \`${leverageToken}\`\n• New Collateral Ratio: \`${collateralRatioAfterRebalance}\`\n• Transaction Hash: \`${tx}\``,
          LogLevel.REBALANCED
        );
      } catch (error) {
        if (error instanceof BaseError) {
          const revertError = error.walk((error) => error instanceof ContractFunctionRevertedError);
          if (revertError instanceof ContractFunctionRevertedError) {
            const errorName = revertError.data?.errorName ?? "";
            if (errorName === "InvalidLeverageTokenStateAfterRebalance") {
              console.log(
                `Auction taken for LeverageToken ${leverageToken} but failed due to invalid leverage token state post rebalance due to stale state. Closing interval...`
              );
              const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
              DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
              clearInterval(interval);
            }
          }
        } else {
          console.error(`Error taking auction for LeverageToken ${leverageToken}. Error: ${error}`);
          throw error;
        }
      }
    }
  } catch (error) {
    console.error(`Error handling auction event for LeverageToken ${leverageToken}. Error: ${error}`);
    throw error;
  }
};

export const subscribeToAuctionCreated = (rebalanceAdapter: Address) => {
  console.log(`Listening for AuctionCreated events on RebalanceAdapter ${rebalanceAdapter}...`);

  publicClient.watchContractEvent({
    address: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onError: error => console.error(error),
    onLogs: () => {
      startDutchAuctionInterval(rebalanceAdapter);
    },
  });
};

export const startDutchAuctionInterval = (rebalanceAdapter: Address) => {
  console.log("AuctionCreated event received. Participating in Dutch auction...");

  // Get current Dutch auction interval for this rebalance adapter
  const currentAuctionInterval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);

  // If there is an interval that is already running, clear it because auction has finished and new one started so we should start
  // new interval from max amounts. Interval should close himself but it can happen that it is not closed right away so we need to
  // close it to avoid having multiple intervals running at the same time for the same rebalance adapter.
  if (currentAuctionInterval) {
    clearInterval(currentAuctionInterval);
  }

  const leverageToken = getLeverageTokenForRebalanceAdapter(rebalanceAdapter);
  const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
  const debtAsset = getLeverageTokenDebtAsset(leverageToken);

  const interval = setInterval(async () => {
    await handleAuctionCreatedEvent(leverageToken, rebalanceAdapter, collateralAsset, debtAsset);
  }, DUTCH_AUCTION_POLLING_INTERVAL);

  DUTCH_AUCTION_ACTIVE_INTERVALS.set(rebalanceAdapter, interval);
}

export const subscribeToAllAuctionCreatedEvents = () => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  console.log(`Leverage tokens: ${leverageTokens.length}`);
  console.log(`LEVERAGE_TOKENS_FILE_PATH: ${LEVERAGE_TOKENS_FILE_PATH}`);
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    subscribeToAuctionCreated(rebalanceAdapter);
  });
};
