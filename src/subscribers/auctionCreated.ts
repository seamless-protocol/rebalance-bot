import { Address, decodeEventLog, Log } from "viem";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { subscribeToEventWithWebSocket } from "../utils/websocketHelpers";
import { getWebSocketUrl, publicClient } from "../utils/transactionHelpers";
import {
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
  getLeverageTokenRebalanceAdapter,
} from "../utils/contractHelpers";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import leverageManagerAbi from "../../abis/LeverageManager";
import {
  BASE_RATIO,
  DEFAULT_DUTCH_AUCTION_POLLING_INTERVAL,
  DEFAULT_DUTCH_AUCTION_STEP_COUNT,
} from "../constants/values";
import { getAmountsOutUniswapV2 } from "../services/uniswapV2";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { LeverageToken } from "../types";

const getLeverageTokenRebalanceData = async (leverageToken: Address, rebalanceAdapter: Address) => {
  const [leverageTokenStateResponse, targetRatioResponse, isAuctionValidResponse] = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
        abi: leverageManagerAbi,
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
    collateral: leverageTokenStateResponse.result[0],
    debt: leverageTokenStateResponse.result[1],
    equity: leverageTokenStateResponse.result[2],
    currentRatio: leverageTokenStateResponse.result[3],
    targetRatio: targetRatioResponse.result,
    isAuctionValid: isAuctionValidResponse.result,
  };
};

const checkIsRebalanceProfitable = async (
  leverageToken: Address,
  assetIn: Address,
  assetOut: Address,
  takeAmount: bigint
) => {
  console.log(`Checking rebalance profitability for leverageToken: ${leverageToken} and takeAmount: ${takeAmount}`);

  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);

  const requiredAmountIn = await publicClient.readContract({
    address: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    functionName: "getAmountIn",
    args: [takeAmount],
  });

  const amountOut = await getAmountsOutUniswapV2({
    inputTokenAddress: assetOut,
    outputTokenAddress: assetIn,
    amountInRaw: takeAmount.toString(),
  });

  return BigInt(amountOut) >= requiredAmountIn;
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

      const isRebalanceProfitable = await checkIsRebalanceProfitable(leverageToken, assetIn, assetOut, takeAmount);
      if (!isRebalanceProfitable) {
        console.log("Rebalance is not profitable. Skipping...");
        continue;
      }

      console.log("Rebalance is profitable. Participating in Dutch auction...");

      // TODO: Participate in Dutch auction
      break;
    }
  } catch (error) {
    console.error("Error handling auction event:", error);
    throw error;
  }
};

export const subscribeToAuctionCreated = (rebalanceAdapter: Address) => {
  console.log(`Listening for AuctionCreated events on RebalanceAdapter ${rebalanceAdapter}...`);

  const rpcUrl = getWebSocketUrl();

  subscribeToEventWithWebSocket({
    contractAddress: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onEvent: (event: Log) => {
      const pollingInterval =
        Number(process.env.DUTCH_AUCTION_POLLING_INTERVAL) || DEFAULT_DUTCH_AUCTION_POLLING_INTERVAL;

      // TODO: Store this interval and close it when LT is no longer eligible for rebalance
      setInterval(async () => {
        await handleAuctionCreatedEvent(rebalanceAdapter, event);
      }, pollingInterval);
    },
    rpcUrl,
  });
};

export const subscribeToAllAuctionCreatedEvents = () => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    subscribeToAuctionCreated(rebalanceAdapter);
  });
};
