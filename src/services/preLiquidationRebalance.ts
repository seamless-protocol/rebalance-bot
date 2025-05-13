import { Address, BaseError, ContractFunctionRevertedError } from "viem";
import { BASE_RATIO, DUTCH_AUCTION_ACTIVE_INTERVALS, PRE_LIQUIDATION_STEP_COUNT } from "../constants/values";
import { getDummySwapParams, getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { LogLevel, RebalanceType, StakeType } from "../types";
import { leverageManagerContract, rebalancerContract } from "../utils/contractHelpers";

import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { getStakeParams } from "../services/routing/getStakeParams";
import { sendAlert } from "../utils/alerts";
import { publicClient } from "../utils/transactionHelpers";

const getLeverageTokenRebalanceData = async (leverageToken: Address, rebalanceAdapter: Address) => {
  const [leverageTokenStateResponse, targetRatioResponse] = await publicClient.multicall({
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
    ],
  });

  if (leverageTokenStateResponse?.result == undefined || targetRatioResponse?.result == undefined) {
    console.error("Failed to get leverage token rebalance data");
    throw new Error("Failed to get leverage token rebalance data");
  }

  return {
    collateral: leverageTokenStateResponse.result.collateralInDebtAsset,
    equity: leverageTokenStateResponse.result.equity,
    targetRatio: targetRatioResponse.result,
  };
};

const executePreLiquidationRebalance = async (
  leverageToken: Address,
  rebalanceAdapter: Address,
  collateralAsset: Address,
  debtAsset: Address
) => {
  try {
    const { collateral, equity, targetRatio } = await getLeverageTokenRebalanceData(leverageToken, rebalanceAdapter);

    const baseRatio = BASE_RATIO;
    const targetCollateral = (equity * targetRatio) / baseRatio;

    const assetIn = debtAsset;
    const assetOut = collateralAsset;
    const maxAmountToTake = targetCollateral - collateral;

    const rebalanceType = RebalanceType.REBALANCE_UP;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = PRE_LIQUIDATION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    // Determine whether we can use native EtherFi staking for swapping assets
    const stakeType =
      collateralAsset == CONTRACT_ADDRESSES.WEETH && debtAsset == CONTRACT_ADDRESSES.WETH
        ? StakeType.ETHERFI_ETH_WEETH
        : StakeType.NONE;

    // TODO: Instead of for loop maybe put this in big multicall
    for (let i = 0; i <= stepCount; i++) {
      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);

      const requiredAmountIn = await publicClient;

      const [isAuctionValid, swapParams, stakeParams] = await Promise.all([
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
          requiredAmountIn,
        }),
        getStakeParams(rebalanceAdapter, stakeType, takeAmount),
      ]);

      if (!isAuctionValid) {
        console.log(`Auction is no longer valid for LeverageToken ${leverageToken}. Closing interval...`);

        const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
        DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
        clearInterval(interval);

        return;
      }

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

        const tx = await rebalancerContract.write.takeAuction([
          leverageToken,
          takeAmount,
          rebalanceType,
          rebalanceSwapParams,
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
