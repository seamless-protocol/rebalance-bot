import { Address, decodeEventLog, Log, parseEther } from "viem";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { parentPort } from "worker_threads";
import {
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
} from "../utils/contractHelpers";
import { publicClient } from "../utils/transactionHelpers";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import leverageManagerAbi from "../../abis/LeverageManager";
import { getAmountsOutUniswapV2 } from "../services/uniswapV2";

const handleAuctionEvent = async (rebalanceAdapter: Address, event: Log) => {
  console.log("rebalancer address", rebalanceAdapter);

  try {
    const decodedEvent = decodeEventLog({
      abi: RebalanceAdapterAbi,
      data: event.data,
      topics: event.topics,
    });

    if (decodedEvent.eventName === "AuctionCreated") {
      console.log("AuctionCreated event received. Participating in Dutch auction...");

      const leverageToken = getLeverageTokenForRebalanceAdapter(rebalanceAdapter);
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
        console.error("Failed to get required data from multicall");
        return;
      }

      // Destructure the response, collateral, debt, equity, collateral ratio
      const leverageTokenState = leverageTokenStateResponse.result;
      const collateral = leverageTokenState[0];
      const debt = leverageTokenState[1];
      const equity = leverageTokenState[2];
      const currentRatio = leverageTokenState[3];

      const targetRatio = targetRatioResponse.result;
      const isAuctionValid = isAuctionValidResponse.result;

      if (!isAuctionValid) {
        console.log("Auction is not valid. Skipping rebalance...");
        return;
      }

      const isOverCollateralized = currentRatio > targetRatio;

      console.log(`Strategy is over-collateralized? -${isOverCollateralized}`);

      const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
      const debtAsset = getLeverageTokenDebtAsset(leverageToken);

      const baseRatio = parseEther("1");

      const targetCollateral = (equity * targetRatio) / baseRatio;
      const targetDebt = (equity * (targetRatio - baseRatio)) / baseRatio;

      const maxAmountToTake = isOverCollateralized ? targetDebt - debt : targetCollateral - collateral;

      // 10% decrease per step
      const decreasePerStep = maxAmountToTake / 10n;

      for (let i = 0; i <= 10; i++) {
        const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);

        console.log(`Calculating rebalance profitability for takeAmount: ${takeAmount}`);

        const requiredAmountIn = await publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "getAmountIn",
          args: [takeAmount],
        });

        const assetIn = isOverCollateralized ? collateralAsset : debtAsset;
        const assetOut = isOverCollateralized ? debtAsset : collateralAsset;

        const amountOut = BigInt(
          await getAmountsOutUniswapV2({
            inputTokenAddress: assetOut,
            outputTokenAddress: assetIn,
            amountInRaw: takeAmount.toString(),
          })
        );

        if (amountOut < requiredAmountIn) {
          console.log("Rebalance is not profitable. Skipping...");
          continue;
        }

        console.log("Rebalance is profitable. Participating in Dutch auction...");

        // TODO: Participate in Dutch auction
        break;
      }
    }
  } catch (error) {
    console.error("Error handling auction event:", error);
    throw error;
  }
};

// Set up message handler for the worker
parentPort?.on("message", async (e: any) => {
  console.log("e", e);
  const { rebalanceAdapter, event } = e;

  console.log("rebalanceAdapter", rebalanceAdapter);
  console.log("event", event);

  try {
    // Initial handling
    await handleAuctionEvent(rebalanceAdapter, event);

    // Set up interval for periodic handling (every minute)
    setInterval(async () => {
      await handleAuctionEvent(rebalanceAdapter, event);
    }, 10_000); // 10 seconds = 10 seconds
  } catch (error) {
    console.error("Fatal error in worker:", error);
  }
});
