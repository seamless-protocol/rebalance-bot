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
import { getPaddedGas, publicClient } from "../utils/transactionHelpers";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";
import { CHAIN_ID } from "../constants/chain";
import { getPreLiquidationLock } from "../utils/locks";
import { createComponentLogger } from "../utils/logger";

const executePreLiquidationRebalanceLogger = createComponentLogger('executePreLiquidationRebalance');
const preLiquidationRebalanceIntervalLogger = createComponentLogger('preLiquidationRebalanceInterval');

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
    executePreLiquidationRebalanceLogger.error({ leverageToken, errorMsg }, "Failed to get rebalance data");
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
    maxAmountToTake = maxAmountToTake * MAX_TAKE_AMOUNT_SCALING / MAX_TAKE_AMOUNT_SCALING_BASE;

    const rebalanceType = RebalanceType.REBALANCE_UP;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = PRE_LIQUIDATION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    for (let i = 0; i < stepCount; i++) {
      const isPreLiquidationEligible = await preLiquidationRebalancer.read.isEligibleForPreLiquidationRebalance([
        leverageToken,
      ]);

      if (!isPreLiquidationEligible) {
        executePreLiquidationRebalanceLogger.info({ leverageToken }, "LeverageToken is not eligible for pre liquidation rebalance, closing interval");

        clearPreLiquidationInterval(leverageToken);

        return;
      }

      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);
      const requiredAmountIn = await preLiquidationRebalancer.read.getAmountIn([leverageToken, takeAmount]);

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
          takeAmount: takeAmount.toString(),
          assetIn
        }, "PreLiquidationRebalance is not profitable, skipping");
        continue;
      }

      executePreLiquidationRebalanceLogger.info({
        leverageToken,
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
