import { Address, BaseError, ContractFunctionRevertedError, WaitForTransactionReceiptTimeoutError, WaitForTransactionReceiptReturnType } from "viem";
import {
  BASE_RATIO,
  MAX_TAKE_AMOUNT_SCALING,
  MAX_TAKE_AMOUNT_SCALING_BASE,
  PRE_LIQUIDATION_ACTIVE_INTERVALS,
  PRE_LIQUIDATION_POLLING_INTERVAL,
  PRE_LIQUIDATION_STEP_COUNT,
  PRE_LIQUIDATION_TIMEOUT,
} from "../constants/values";
import { getRebalanceSwapParams } from "./routing/getSwapParams";
import { LogLevel, RebalanceType, StakeType } from "../types";
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
import { getPaddedGas, publicClient } from "../utils/transactionHelpers";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";
import { CHAIN_ID } from "../constants/chain";
import { getPreLiquidationLock } from "../utils/locks";
import { createComponentLogger } from "../utils/logger";

const executePreLiquidationRebalanceLogger = createComponentLogger('executePreLiquidationRebalance');
const preLiquidationRebalanceIntervalLogger = createComponentLogger('preLiquidationRebalanceInterval');

const REWARD_BASE = 10000n;
const WAD = 10n ** 18n;


interface RebalanceAmounts {
  debtToRepay: bigint;
  collateralToWithdraw: bigint;
  collateralToWithdrawInDebtAsset: bigint;
}

const getPreLiquidationReward = async (
  leverageToken: Address,
  lendingAdapter: Address,
  rebalanceAdapter: Address
): Promise<bigint> => {
  const [liquidationPenaltyResponse, rebalanceRewardResponse] = await publicClient.multicall({
    contracts: [
      {
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getLiquidationPenalty",
      },
      {
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "getRebalanceReward",
      },
    ],
  });

  if (liquidationPenaltyResponse?.result === undefined || rebalanceRewardResponse?.result === undefined) {
    throw new Error(`Failed to get liquidation penalty or rebalance reward for LeverageToken ${leverageToken}`);
  }

  const liquidationPenalty = liquidationPenaltyResponse.result;
  const rebalanceReward = rebalanceRewardResponse.result;

  return (liquidationPenalty * rebalanceReward) / REWARD_BASE;
};

const calculateRebalanceAmounts = async (
  debtToRepay: bigint,
  reward: bigint,
  lendingAdapter: Address
): Promise<RebalanceAmounts> => {
  // Use the full reward for collateral calculation to withdraw maximum collateral per unit of debt.
  const collateralToWithdrawInDebtAsset = (debtToRepay * (WAD + reward)) / WAD;

  const collateralToWithdraw = await publicClient.readContract({
    address: lendingAdapter,
    abi: LendingAdapterAbi,
    functionName: "convertDebtToCollateralAsset",
    args: [collateralToWithdrawInDebtAsset],
  });

  return {
    debtToRepay,
    collateralToWithdraw,
    collateralToWithdrawInDebtAsset,
  };
};

const calculateMaxDebtToRepay = (
  collateralInDebtAsset: bigint,
  debt: bigint,
  targetRatio: bigint
): bigint => {
  // Formula: debtRepaid = (CR_target × Debt - CollateralInDebt) / (CR_target - 1)
  // With WAD scaling: (targetRatio * debt - collateralInDebtAsset * BASE_RATIO) / (targetRatio - BASE_RATIO)
  const numerator = targetRatio * debt - collateralInDebtAsset * BASE_RATIO;
  const denominator = targetRatio - BASE_RATIO;

  return numerator / denominator;
};

interface PreLiquidationRebalanceData {
  collateralInDebtAsset: bigint;
  debt: bigint;
  targetRatio: bigint;
}

const getLeverageTokenRebalanceData = async (
  leverageToken: Address,
  rebalanceAdapter: Address
): Promise<PreLiquidationRebalanceData> => {
  const [leverageTokenStateResponse, targetRatioResponse] = await publicClient.multicall({
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
    ],
  });

  if (
    leverageTokenStateResponse?.result == undefined ||
    targetRatioResponse?.result == undefined
  ) {
    const errorMsg = `Failed to get rebalance data for LeverageToken ${leverageToken}`;
    executePreLiquidationRebalanceLogger.error({ leverageToken, errorMsg }, "Failed to get rebalance data");
    throw new Error(errorMsg);
  }

  return {
    collateralInDebtAsset: leverageTokenStateResponse.result.collateralInDebtAsset,
    debt: leverageTokenStateResponse.result.debt,
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
    const lendingAdapter = getLeverageTokenLendingAdapter(leverageToken);
    const { collateralInDebtAsset, debt, targetRatio } = await getLeverageTokenRebalanceData(
      leverageToken,
      rebalanceAdapter
    );

    const maxPreLiquidationReward = await getPreLiquidationReward(leverageToken, lendingAdapter, rebalanceAdapter);

    let maxDebtToRepay = calculateMaxDebtToRepay(
      collateralInDebtAsset,
      debt,
      targetRatio
    );

    // Scale down maxDebtToRepay to accommodate for potential redemptions between simulation and execution.
    // If a redemption is confirmed between the preLiquidationRebalance simulation/gas estimation and the
    // transaction execution, the max repay amount may decrease, causing the transaction to revert if the
    // amount to repay is higher than the new max.
    // Note: Interest accrual increases max debt to repay over time, so this scaling provides headroom
    // for redemptions while interest naturally provides headroom in the other direction.
    maxDebtToRepay = maxDebtToRepay * MAX_TAKE_AMOUNT_SCALING / MAX_TAKE_AMOUNT_SCALING_BASE;

    const assetIn = debtAsset;
    const assetOut = collateralAsset;
    const rebalanceType = RebalanceType.REBALANCE_UP;

    const stepCount = PRE_LIQUIDATION_STEP_COUNT;
    const decreasePerStep = maxDebtToRepay / BigInt(stepCount);

    for (let i = 0; i < stepCount; i++) {
      const isPreLiquidationEligible = await preLiquidationRebalancer.read.isEligibleForPreLiquidationRebalance([
        leverageToken,
      ]);

      if (!isPreLiquidationEligible) {
        executePreLiquidationRebalanceLogger.info({ leverageToken }, "LeverageToken is not eligible for pre liquidation rebalance, closing interval");

        clearPreLiquidationInterval(leverageToken);

        return;
      }

      const debtToRepay = maxDebtToRepay - decreasePerStep * BigInt(i);
      const { collateralToWithdraw, collateralToWithdrawInDebtAsset: calculatedCollateralInDebtAsset } = await calculateRebalanceAmounts(
        debtToRepay,
        maxPreLiquidationReward,
        lendingAdapter
      );

      // Convert collateral back to debt terms using oracle to match on-chain calculation
      const actualCollateralToWithdrawInDebtAsset = await publicClient.readContract({
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "convertCollateralToDebtAsset",
        args: [collateralToWithdraw],
      });

      const expectedNewCollateralInDebtAsset = collateralInDebtAsset - actualCollateralToWithdrawInDebtAsset;
      const expectedNewDebt = debt - debtToRepay;
      // Collateral ratio = Collateral / Debt
      const expectedCollateralRatioAfterRebalance = (expectedNewCollateralInDebtAsset * BASE_RATIO) / expectedNewDebt;

      // Calculate equity values for isStateAfterRebalanceValid check
      const currentEquity = collateralInDebtAsset - debt;
      const expectedEquityAfter = expectedNewCollateralInDebtAsset - expectedNewDebt;
      // maxEquityLoss = debtDelta * (liquidationPenalty * rebalanceReward / REWARD_BASE) / WAD
      // maxPreLiquidationReward already equals (liquidationPenalty * rebalanceReward / REWARD_BASE)
      const maxEquityLoss = (debtToRepay * maxPreLiquidationReward) / WAD;
      const minRequiredEquity = currentEquity - maxEquityLoss;

      executePreLiquidationRebalanceLogger.info({
        leverageToken,
        debtToRepay: debtToRepay.toString(),
        collateralToWithdraw: collateralToWithdraw.toString(),
        calculatedCollateralInDebtAsset: calculatedCollateralInDebtAsset.toString(),
        actualCollateralToWithdrawInDebtAsset: actualCollateralToWithdrawInDebtAsset.toString(),
        expectedNewCollateralInDebtAsset: expectedNewCollateralInDebtAsset.toString(),
        expectedNewDebt: expectedNewDebt.toString(),
        expectedCollateralRatioAfterRebalance: expectedCollateralRatioAfterRebalance.toString(),
        targetRatio: targetRatio.toString(),
        currentCollateralInDebtAsset: collateralInDebtAsset.toString(),
        currentDebt: debt.toString(),
        currentEquity: currentEquity.toString(),
        expectedEquityAfter: expectedEquityAfter.toString(),
        maxEquityLoss: maxEquityLoss.toString(),
        minRequiredEquity: minRequiredEquity.toString(),
      }, "Expected state after pre-liquidation rebalance");

      if (expectedCollateralRatioAfterRebalance >= targetRatio) {
        const errorMsg = `Expected collateral ratio after rebalance (${expectedCollateralRatioAfterRebalance}) is >= target ratio (${targetRatio}). This would cause the transaction to revert.`;
        executePreLiquidationRebalanceLogger.error({
          leverageToken,
          expectedCollateralRatioAfterRebalance: expectedCollateralRatioAfterRebalance.toString(),
          targetRatio: targetRatio.toString(),
          debtToRepay: debtToRepay.toString(),
          actualCollateralToWithdrawInDebtAsset: actualCollateralToWithdrawInDebtAsset.toString(),
          maxPreLiquidationReward: maxPreLiquidationReward.toString(),
        }, errorMsg);
        throw new Error(errorMsg);
      }

      // Check isStateAfterRebalanceValid: stateAfter.equity >= stateBefore.equity - maxEquityLoss
      if (expectedEquityAfter < minRequiredEquity) {
        const errorMsg = `Expected equity after rebalance (${expectedEquityAfter}) is < min required equity (${minRequiredEquity}). isStateAfterRebalanceValid would fail.`;
        executePreLiquidationRebalanceLogger.error({
          leverageToken,
          expectedEquityAfter: expectedEquityAfter.toString(),
          currentEquity: currentEquity.toString(),
          maxEquityLoss: maxEquityLoss.toString(),
          minRequiredEquity: minRequiredEquity.toString(),
          debtToRepay: debtToRepay.toString(),
          maxPreLiquidationReward: maxPreLiquidationReward.toString(),
        }, errorMsg);
        throw new Error(errorMsg);
      }

      const requiredAmountIn = debtToRepay;
      const takeAmount = collateralToWithdraw;

      const swapParams = await getRebalanceSwapParams({
        leverageToken,
        stakeType: StakeType.NONE,
        receiver: CONTRACT_ADDRESSES[CHAIN_ID].PRE_LIQUIDATION_REBALANCER,
        assetIn,
        assetOut,
        takeAmount,
        requiredAmountIn,
        collateralAsset,
        debtAsset,
      });

      if (!swapParams.isProfitable) {
        executePreLiquidationRebalanceLogger.debug({
          leverageToken,
          debtToRepay: debtToRepay.toString(),
          takeAmount: takeAmount.toString(),
          assetIn
        }, "PreLiquidationRebalance is not profitable, skipping");
        continue;
      }

      executePreLiquidationRebalanceLogger.info({
        leverageToken,
        debtToRepay: debtToRepay.toString(),
        takeAmount: takeAmount.toString(),
        assetIn
      }, "PreLiquidationRebalance is profitable, participating in rebalance");

      try {
        // Will throw an error if reverts
        const { request: simulationRequest } = await preLiquidationRebalancer.simulate.preLiquidationRebalance([
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
        ], {
          gas: simulationRequest.gas ? getPaddedGas(simulationRequest.gas) : undefined,
        });

        executePreLiquidationRebalanceLogger.info({ leverageToken, transactionHash: tx }, "preLiquidationRebalance transaction submitted");

        let receipt: WaitForTransactionReceiptReturnType;
        try {
          receipt = await publicClient.waitForTransactionReceipt({
            hash: tx,
            timeout: PRE_LIQUIDATION_TIMEOUT
          });
        } catch (error) {
          if (error instanceof WaitForTransactionReceiptTimeoutError) {
            await sendAlert(`*Timeout while waiting for takeAuction transaction receipt for LeverageToken ${leverageToken}*\n• Transaction Hash: \`${tx}\``, LogLevel.ERROR);
            executePreLiquidationRebalanceLogger.error({ leverageToken, transactionHash: tx }, "Timeout while waiting for takeAuction transaction receipt");

            // We continue trying to preLiquidationRebalance if waiting for the transaction receipt timed out
            continue;
          }

          executePreLiquidationRebalanceLogger.error({ leverageToken, error }, "Error waiting for preLiquidationRebalance transaction receipt");
          throw error;
        }

        if (receipt.status === "reverted") {
          const errorString = `Transaction for preLiquidationRebalance of LeverageToken ${leverageToken} reverted. takeAmount: ${takeAmount}. Transaction hash: ${tx}`;
          await sendAlert(`*Error submitting preLiquidationRebalance transaction*\n${errorString}`, LogLevel.ERROR);
          executePreLiquidationRebalanceLogger.error({
            leverageToken,
            takeAmount: takeAmount.toString(),
            transactionHash: tx
          }, "Transaction for preLiquidationRebalance reverted");

          // We continue trying to preLiquidationRebalance with the next step, since it's likely that the transaction reverted
          // due to the max take amount decreasing during on-chain execution because of borrow interest or redemptions
          // between the simulation / gas estimation and the preLiquidationRebalance transaction execution.
          continue;
        }

        const { collateralRatio: collateralRatioAfterRebalance } =
          await leverageManagerContract.read.getLeverageTokenState([leverageToken]);

        executePreLiquidationRebalanceLogger.info({
          leverageToken,
          newCollateralRatio: collateralRatioAfterRebalance.toString(),
          transactionHash: tx
        }, "PreLiquidationRebalance executed successfully");
        await sendAlert(
          `*PreLiquidationRebalance executed successfully*\n• LeverageToken: \`${leverageToken}\`\n• New Collateral Ratio: \`${collateralRatioAfterRebalance}\`\n• Transaction Hash: \`${tx}\``,
          LogLevel.REBALANCED
        );
        return;
      } catch (error) {
        if (error instanceof BaseError) {
          const revertError = error.walk((error) => error instanceof ContractFunctionRevertedError);
          if (revertError instanceof ContractFunctionRevertedError) {
            const errorName = revertError.data?.errorName ?? "";
            if (errorName === "InvalidLeverageTokenStateAfterRebalance") {
              executePreLiquidationRebalanceLogger.warn({ leverageToken }, "PreLiquidationRebalance executed but failed due to invalid leverage token state post rebalance due to stale state");
            } else {
              executePreLiquidationRebalanceLogger.error({ leverageToken, error, errorName }, "ContractFunctionRevertedError executing PreLiquidationRebalance");
              throw error;
            }
          } else {
            executePreLiquidationRebalanceLogger.error({ leverageToken, error }, "Error executing PreLiquidationRebalance");
            throw error;
          }
        } else {
          executePreLiquidationRebalanceLogger.error({ leverageToken, error }, "Error executing PreLiquidationRebalance");
          throw error;
        }
      }
    }
  } catch (error) {
    executePreLiquidationRebalanceLogger.error({ leverageToken, error }, "Error executing PreLiquidationRebalance");
    sendAlert(`*Error executing PreLiquidationRebalance for LeverageToken ${leverageToken}*\n• Error: \`${error}\``, LogLevel.ERROR);
    throw error;
  }
};

const clearPreLiquidationInterval = (leverageToken: Address) => {
  const currentInterval = PRE_LIQUIDATION_ACTIVE_INTERVALS.get(leverageToken);

  if (currentInterval) {
    PRE_LIQUIDATION_ACTIVE_INTERVALS.delete(leverageToken);
    clearInterval(currentInterval);
  }
};

export const startPreLiquidationRebalanceInInterval = async (leverageToken: Address) => {
  if (PRE_LIQUIDATION_ACTIVE_INTERVALS.has(leverageToken)) {
    preLiquidationRebalanceIntervalLogger.debug({ leverageToken }, "PreLiquidationRebalance interval already exists, skipping");
    return;
  }

  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);
  const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
  const debtAsset = getLeverageTokenDebtAsset(leverageToken);

  const interval = setInterval(async () => {
    const lock = getPreLiquidationLock(leverageToken, interval);

    let leaseOwner: symbol;
    try {
      leaseOwner = lock.acquire();
    } catch (error) {
      preLiquidationRebalanceIntervalLogger.debug({ leverageToken }, "Lock for PreLiquidationRebalance interval is occupied, skipping interval execution");
      return;
    }

    try {
      await executePreLiquidationRebalance(leverageToken, rebalanceAdapter, collateralAsset, debtAsset);
    } finally {
      lock.release(leaseOwner);
    }

  }, PRE_LIQUIDATION_POLLING_INTERVAL);

  PRE_LIQUIDATION_ACTIVE_INTERVALS.set(leverageToken, interval);
};
