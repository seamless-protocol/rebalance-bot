import { Address, BaseError, ContractFunctionRevertedError } from "viem";
import {
  BASE_RATIO,
  PRE_LIQUIDATION_ACTIVE_INTERVALS,
  PRE_LIQUIDATION_POLLING_INTERVAL,
  PRE_LIQUIDATION_STEP_COUNT,
} from "../constants/values";
import { getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { LeverageTokenRebalanceData, LogLevel, RebalanceType } from "../types";
import {
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenLendingAdapter,
  getLeverageTokenRebalanceAdapter,
  getPreLiquidationRebalancerContract,
  leverageManagerContract,
} from "../utils/contractHelpers";
import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { sendAlert } from "../utils/alerts";
import { publicClient } from "../utils/transactionHelpers";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";

const getLeverageTokenRebalanceData = async (
  leverageToken: Address,
  rebalanceAdapter: Address
): Promise<LeverageTokenRebalanceData> => {
  const lendingAdapter = getLeverageTokenLendingAdapter(leverageToken);

  const [leverageTokenStateResponse, targetRatioResponse, collateralResponse] = await publicClient.multicall({
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
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getCollateral",
      },
    ],
  });

  if (
    leverageTokenStateResponse?.result == undefined ||
    targetRatioResponse?.result == undefined ||
    collateralResponse?.result == undefined
  ) {
    const errorMsg = `Failed to get rebalance data for LeverageToken ${leverageToken}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  return {
    collateral: collateralResponse.result,
    collateralInDebtAsset: leverageTokenStateResponse.result.collateralInDebtAsset,
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
    const preLiquidationRebalancer = getPreLiquidationRebalancerContract();
    const { collateral, collateralInDebtAsset, equity, targetRatio } = await getLeverageTokenRebalanceData(
      leverageToken,
      rebalanceAdapter
    );

    const baseRatio = BASE_RATIO;
    const targetCollateralInDebtAsset = (equity * targetRatio) / baseRatio;

    const assetIn = debtAsset;
    const assetOut = collateralAsset;
    const maxAmountToTakeInDebtAsset = collateralInDebtAsset - targetCollateralInDebtAsset;
    const maxAmountToTake = (collateral * maxAmountToTakeInDebtAsset) / collateralInDebtAsset;

    const rebalanceType = RebalanceType.REBALANCE_UP;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = PRE_LIQUIDATION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    for (let i = 0; i < stepCount; i++) {
      const isPreLiquidationEligible = await preLiquidationRebalancer.read.isEligibleForPreLiquidationRebalance([
        leverageToken,
      ]);

      if (!isPreLiquidationEligible) {
        console.log(
          `LeverageToken ${leverageToken} is not eligible for pre liquidation rebalance. Closing interval...`
        );

        const interval = PRE_LIQUIDATION_ACTIVE_INTERVALS.get(leverageToken);
        PRE_LIQUIDATION_ACTIVE_INTERVALS.delete(leverageToken);
        clearInterval(interval);

        return;
      }

      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);
      const requiredAmountIn = await preLiquidationRebalancer.read.getAmountIn([leverageToken, takeAmount]);

      const swapParams = await getRebalanceSwapParams({
        leverageToken,
        assetIn,
        assetOut,
        takeAmount,
        requiredAmountIn: requiredAmountIn,
      });

      if (!swapParams.isProfitable) {
        console.log(
          `PreLiquidationRebalance is not profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} asset: ${assetIn}. Skipping...`
        );
        continue;
      }

      console.log(
        `PreLiquidationRebalance is profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} asset: ${assetIn}. Participating in pre liquidation rebalance...`
      );

      try {
        const tx = await preLiquidationRebalancer.write.preLiquidationRebalance([
          leverageToken,
          swapParams.amountOut,
          takeAmount,
          rebalanceType,
          swapParams,
        ]);

        await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        const { collateralRatio: collateralRatioAfterRebalance } =
          await leverageManagerContract.read.getLeverageTokenState([leverageToken]);

        console.log(
          `PreLiquidationRebalance executed successfully. LeverageToken: ${leverageToken}, New collateral ratio: ${collateralRatioAfterRebalance}, Transaction hash: ${tx}`
        );
        await sendAlert(
          `*PreLiquidationRebalance executed successfully*\n• LeverageToken: \`${leverageToken}\`\n• New Collateral Ratio: \`${collateralRatioAfterRebalance}\`\n• Transaction Hash: \`${tx}\``,
          LogLevel.REBALANCED
        );
      } catch (error) {
        if (error instanceof BaseError) {
          const revertError = error.walk((error) => error instanceof ContractFunctionRevertedError);
          if (revertError instanceof ContractFunctionRevertedError) {
            const errorName = revertError.data?.errorName ?? "";
            if (errorName === "InvalidLeverageTokenStateAfterRebalance") {
              console.log(
                `PreLiquidationRebalance executed for LeverageToken ${leverageToken} but failed due to invalid leverage token state post rebalance due to stale state. Closing interval...`
              );
            }
          }
        } else {
          console.error(`Error executing PreLiquidationRebalance for LeverageToken ${leverageToken}. Error: ${error}`);
          throw error;
        }
      }
    }
  } catch (error) {
    const interval = PRE_LIQUIDATION_ACTIVE_INTERVALS.get(leverageToken);
    PRE_LIQUIDATION_ACTIVE_INTERVALS.delete(leverageToken);
    clearInterval(interval);

    console.error(`Error executing PreLiquidationRebalance for LeverageToken ${leverageToken}. Error: ${error}`);
    throw error;
  }
};

export const startPreLiquidationRebalanceInInterval = async (leverageToken: Address) => {
  if (PRE_LIQUIDATION_ACTIVE_INTERVALS.has(leverageToken)) {
    console.log(`PreLiquidationRebalance interval already exists for LeverageToken ${leverageToken}. Skipping...`);
    return;
  }

  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);
  const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
  const debtAsset = getLeverageTokenDebtAsset(leverageToken);

  const interval = setInterval(async () => {
    await executePreLiquidationRebalance(leverageToken, rebalanceAdapter, collateralAsset, debtAsset);
  }, PRE_LIQUIDATION_POLLING_INTERVAL);

  PRE_LIQUIDATION_ACTIVE_INTERVALS.set(leverageToken, interval);
};
