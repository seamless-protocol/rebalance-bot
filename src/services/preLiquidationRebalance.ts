import { Address, BaseError, ContractFunctionRevertedError } from "viem";
import {
  BASE_RATIO,
  PRE_LIQUIDATION_ACTIVE_INTERVALS,
  PRE_LIQUIDATION_LOCK_TIMEOUT,
  PRE_LIQUIDATION_POLLING_INTERVAL,
  PRE_LIQUIDATION_STEP_COUNT,
} from "../constants/values";
import { getRebalanceSwapParams } from "./routing/getSwapParams";
import { LeverageTokenRebalanceData, LogLevel, RebalanceType, StakeType } from "../types";
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
import { CHAIN_ID } from "../constants/chain";
import { getPreLiquidationLock } from "../utils/locks";

const getLeverageTokenRebalanceData = async (
  leverageToken: Address,
  rebalanceAdapter: Address
): Promise<LeverageTokenRebalanceData> => {
  const lendingAdapter = getLeverageTokenLendingAdapter(leverageToken);

  const [leverageTokenStateResponse, targetRatioResponse, collateralResponse] = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACT_ADDRESSES[CHAIN_ID].LEVERAGE_MANAGER,
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

    let maxAmountToTake = (collateral * maxAmountToTakeInDebtAsset) / collateralInDebtAsset;

    // Decrease maxAmountToTake by 1% to accommodate for collateral ratio continuously decreasing due to borrow interest,
    // causing the max take amount to continuously decrease as well.
    // We do this to avoid preLiquidationRebalance transaction reverts due to take amounts being too high, which can occur if the
    // latency between the preLiquidationRebalance simulation and the transaction execution is enough time to cause max take amounts to decrease
    // for the reason mentioned above.
    // The max take amount can also decrease due to redemptions. If a redemption is confirmed between the time of the preLiquidationRebalance
    // simulation / gas estimation and the transaction execution, the preLiquidationRebalance transaction will still be submitted but will revert
    // if the amount to take is higher than the new max take amount post redemption.
    maxAmountToTake = maxAmountToTake * 99n / 100n;

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
        stakeType: StakeType.NONE,
        assetIn,
        assetOut,
        takeAmount,
        requiredAmountIn,
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
        const lock = getPreLiquidationLock(leverageToken);
        let leaseOwner: symbol;

        try {
          // Try to acquire preLiquidationRebalance lock
          leaseOwner = lock.acquire(PRE_LIQUIDATION_LOCK_TIMEOUT);
        } catch (error) {
          console.log(`PreLiquidationRebalance mutex is locked for LeverageToken ${leverageToken}. Skipping...`);
          continue;
        }

        try {
          // Will throw an error if reverts
          await preLiquidationRebalancer.simulate.preLiquidationRebalance([
            leverageToken,
            requiredAmountIn,
            takeAmount,
            rebalanceType,
            CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
            swapParams.swapCalls,
          ]);

          const tx = await preLiquidationRebalancer.write.preLiquidationRebalance([
            leverageToken,
            requiredAmountIn,
            takeAmount,
            rebalanceType,
            CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
            swapParams.swapCalls,
          ]);

          console.log(`preLiquidationRebalance transaction submitted for LeverageToken ${leverageToken}. Pending transaction hash: ${tx}`);

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: tx,
          });

          // Release the lock immediately after the transaction is confirmed to free up the lock for other intervals
          lock.release(leaseOwner);

          if (receipt.status === "reverted") {
            const errorString = `Transaction for preLiquidationRebalance of LeverageToken ${leverageToken} reverted. takeAmount: ${takeAmount}. Transaction hash: ${tx}`;
            await sendAlert(`*Error submitting preLiquidationRebalance transaction*\n${errorString}`, LogLevel.ERROR);

            // We continue trying to preLiquidationRebalance with the next step, since it's likely that the transaction reverted
            // due to the max take amount decreasing during on-chain execution because of borrow interest or redemptions
            // between the simulation / gas estimation and the preLiquidationRebalance transaction execution.
            continue;
          }

          const { collateralRatio: collateralRatioAfterRebalance } =
            await leverageManagerContract.read.getLeverageTokenState([leverageToken]);

          console.log(
            `PreLiquidationRebalance executed successfully. LeverageToken: ${leverageToken}, New collateral ratio: ${collateralRatioAfterRebalance}, Transaction hash: ${tx}`
          );
          await sendAlert(
            `*PreLiquidationRebalance executed successfully*\n• LeverageToken: \`${leverageToken}\`\n• New Collateral Ratio: \`${collateralRatioAfterRebalance}\`\n• Transaction Hash: \`${tx}\``,
            LogLevel.REBALANCED
          );
        } finally {
          // Ensure the lock is released regardless of revert or success
          lock.release(leaseOwner);
        }
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
