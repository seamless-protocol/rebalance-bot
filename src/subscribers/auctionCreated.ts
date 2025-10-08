import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  hexToBigInt,
  isAddressEqual,
  toHex,
  WaitForTransactionReceiptReturnType,
  WaitForTransactionReceiptTimeoutError
} from "viem";
import {
  BASE_RATIO,
  CHECK_PROFITABILITY_WITH_GAS_FEE,
  DUTCH_AUCTION_ACTIVE_INTERVALS,
  DUTCH_AUCTION_POLLING_INTERVAL,
  DUTCH_AUCTION_STEP_COUNT,
  MAX_TAKE_AMOUNT_SCALING,
  MAX_TAKE_AMOUNT_SCALING_BASE,
  IS_USING_FORK,
  TAKE_AUCTION_TIMEOUT
} from "../constants/values";
import { DutchAuctionRebalancerAbi } from "../../abis/DutchAuctionRebalancer";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";
import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { CHAIN_ID, LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { sendAlert } from "../utils/alerts";
import {
  dutchAuctionRebalancerContract,
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
  getLeverageTokenLendingAdapter,
  getLeverageTokenRebalanceAdapter,
  leverageManagerContract,
} from "../utils/contractHelpers";
import { getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { GetRebalanceSwapParamsOutput, LeverageToken, LogLevel, RebalanceType, StakeType } from "../types";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { tenderlySimulateTransaction } from "../utils/tenderly";
import { getPaddedGas, publicClient, walletClient } from "../utils/transactionHelpers";
import { Pricer } from "../services/pricers/pricer";
import { getDutchAuctionLock } from '../utils/locks';

const getLeverageTokenRebalanceData = async (leverageToken: Address, lendingAdapter: Address, rebalanceAdapter: Address) => {
  const [leverageTokenStateResponse, collateralResponse, equityInCollateralAssetResponse, targetRatioResponse, isAuctionValidResponse, currentAuctionMultiplierResponse] = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACT_ADDRESSES[CHAIN_ID].LEVERAGE_MANAGER,
        abi: LeverageManagerAbi,
        functionName: "getLeverageTokenState",
        args: [leverageToken],
      },
      {
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getCollateral",
      },
      {
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getEquityInCollateralAsset",
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
      {
        address: rebalanceAdapter,
        abi: RebalanceAdapterAbi,
        functionName: "getCurrentAuctionMultiplier"
      }
    ],
  });

  if (
    leverageTokenStateResponse?.result == undefined ||
    collateralResponse?.result == undefined ||
    equityInCollateralAssetResponse?.result == undefined ||
    targetRatioResponse?.result == undefined ||
    isAuctionValidResponse?.result == undefined ||
    currentAuctionMultiplierResponse?.result == undefined
  ) {
    console.error("Failed to get leverage token rebalance data");
    throw new Error("Failed to get leverage token rebalance data");
  }

  return {
    collateral: collateralResponse.result,
    debt: leverageTokenStateResponse.result.debt,
    equityInDebtAsset: leverageTokenStateResponse.result.equity,
    equityInCollateralAsset: equityInCollateralAssetResponse.result,
    currentRatio: leverageTokenStateResponse.result.collateralRatio,
    targetRatio: targetRatioResponse.result,
    isAuctionValid: isAuctionValidResponse.result,
    currentAuctionMultiplier: currentAuctionMultiplierResponse.result,
  };
};

const getStakeType = (collateralAsset: Address, debtAsset: Address, isOverCollateralized: boolean): StakeType => {
  if (
    isAddressEqual(collateralAsset, CONTRACT_ADDRESSES[CHAIN_ID].WEETH) &&
    isAddressEqual(debtAsset, CONTRACT_ADDRESSES[CHAIN_ID].WETH) &&
    isOverCollateralized
  ) {
    return StakeType.ETHERFI_ETH_WEETH;
  } else if (
    isAddressEqual(collateralAsset, CONTRACT_ADDRESSES[CHAIN_ID].WSTETH as Address) &&
    isAddressEqual(debtAsset, CONTRACT_ADDRESSES[CHAIN_ID].WETH as Address) &&
    isOverCollateralized &&
    CHAIN_ID === 1
  ) {
    return StakeType.LIDO_ETH_WSTETH;
  } else {
    return StakeType.NONE;
  }
};

export const handleAuctionCreatedEvent = async (
  leverageToken: Address,
  lendingAdapter: Address,
  rebalanceAdapter: Address,
  collateralAsset: Address,
  debtAsset: Address,
  pricers: Pricer[]
) => {
  try {
    const { collateral, debt, equityInDebtAsset, equityInCollateralAsset, currentRatio, targetRatio, isAuctionValid, currentAuctionMultiplier } = await getLeverageTokenRebalanceData(
      leverageToken,
      lendingAdapter,
      rebalanceAdapter
    );

    if (!isAuctionValid) {
      console.log(`Auction is not valid for LeverageToken ${leverageToken}. Closing dutch auction interval...`);
      clearDutchAuctionInterval(leverageToken);
      return;
    }

    const isOverCollateralized = currentRatio > targetRatio;

    console.log(
      `Attempting to take for ${isOverCollateralized ? "over" : "under"}-collateralized LeverageToken ${leverageToken}. Current auction multiplier: ${currentAuctionMultiplier}.`
    );

    const baseRatio = BASE_RATIO;
    const targetCollateral = (equityInCollateralAsset * targetRatio) / (targetRatio - baseRatio);
    const targetDebt = (equityInDebtAsset * baseRatio) / (targetRatio - baseRatio);

    // Calculate what is max amount to take to bring LT to target debt or target collateral
    // If strategy is over-collateralized we are adding collateral and borrowing debt
    // If strategy is under-collateralized we are repaying debt and removing collateral
    const assetIn = isOverCollateralized ? collateralAsset : debtAsset;
    const assetOut = isOverCollateralized ? debtAsset : collateralAsset;

    let maxAmountToTake = isOverCollateralized ? targetDebt - debt : collateral - targetCollateral;

    // Decrease maxAmountToTake by 1% to accommodate for collateral ratio continuously decreasing due to borrow interest,
    // causing the max take amount to continuously decrease as well.
    // We do this to avoid takeAuction transaction reverts due to take amounts being too high, which can occur if the
    // latency between the takeAuction simulation and the transaction execution is enough time to cause max take amounts to decrease
    // for the reason mentioned above.
    // The max take amount can also decrease due to redemptions. If a redemption is confirmed between the time of the takeAuction
    // simulation / gas estimation and the transaction execution, the takeAuction transaction will still be submitted but will revert
    // if the amount to take is higher than the new max take amount post redemption.
    maxAmountToTake = maxAmountToTake * MAX_TAKE_AMOUNT_SCALING / MAX_TAKE_AMOUNT_SCALING_BASE;

    const rebalanceType = isOverCollateralized ? RebalanceType.REBALANCE_DOWN : RebalanceType.REBALANCE_UP;

    // Calculate for how much will amount to take decrease per step so we can check profitability with smaller slippage
    const stepCount = DUTCH_AUCTION_STEP_COUNT;
    const decreasePerStep = maxAmountToTake / BigInt(stepCount);

    const stakeType = getStakeType(collateralAsset, debtAsset, isOverCollateralized);

    // TODO: Instead of for loop maybe put this in big multicall
    for (let i = 0; i < stepCount; i++) {
      const takeAmount = maxAmountToTake - decreasePerStep * BigInt(i);

      const multicallResults = await publicClient.multicall({
        contracts: [
          {
            address: assetIn,
            abi: erc20Abi,
            functionName: "decimals",
          },
          {
            address: rebalanceAdapter,
            abi: RebalanceAdapterAbi,
            functionName: "getAmountIn",
            args: [takeAmount],
          },
          {
            address: CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER,
            abi: DutchAuctionRebalancerAbi,
            functionName: "previewTakeAuction",
            args: [leverageToken, takeAmount, rebalanceType],
          },
        ],
        allowFailure: false,
      });

      const assetInDecimals = multicallResults[0] as number;
      const requiredAmountIn = multicallResults[1] as bigint;
      const [isAuctionValid, newCollateralRatio] = multicallResults[2] as [boolean, bigint];

      if (!isAuctionValid) {
        console.log(`Auction is no longer valid for LeverageToken ${leverageToken}. Closing dutch auction interval...`);

        clearDutchAuctionInterval(leverageToken);

        return;
      }

      // Check that the new collateral ratio does not switch from over the target ratio to under the target ratio or vice versa.
      // This can occur on early steps for over-collateralized LeverageTokens due to borrow interest continuously accruing
      // or oracle price fluctuations, which cause the maximum take amount to decrease
      if ((isOverCollateralized && newCollateralRatio < targetRatio) || (!isOverCollateralized && newCollateralRatio > targetRatio)) {
        console.log(
          `New collateral ratio ${newCollateralRatio} is not valid for ` +
          `${isOverCollateralized ? "over" : "under"}-collateralized LeverageToken ` +
          `${leverageToken} with target ratio ${targetRatio}. ` +
          `Skipping step ${i}...`
        );
        continue;
      }

      const swapParams = await getRebalanceSwapParams({
        stakeType,
        assetIn,
        assetOut,
        takeAmount,
        requiredAmountIn
      });

      if (!swapParams.isProfitable) {
        console.log(
          `Rebalance swap is not profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} assetOut: ${assetOut}. amountIn: ${requiredAmountIn} assetIn: ${assetIn} swapAmountOut: ${swapParams.amountOut} deficit: ${requiredAmountIn - swapParams.amountOut}. Skipping step ${i}...`
        );
        continue;
      }

      if (CHECK_PROFITABILITY_WITH_GAS_FEE) {
        try {
          const { isProfitableWithGasFee, errorFetchingPrices, assetInProfitUsd, gasFeeUsd } = await simulateAndCalculateProfitability(
            pricers,
            rebalanceAdapter,
            assetIn,
            assetInDecimals,
            assetOut,
            takeAmount,
            swapParams,
            requiredAmountIn
          );

          // If we failed to fetch prices for determining profitability, we should still try to take the auction
          if (!isProfitableWithGasFee && !errorFetchingPrices) {
            console.log(
              `Rebalance with gas fee is not profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} assetOut: ${assetOut}. amountIn: ${requiredAmountIn} assetIn: ${assetIn} assetInProfitUsd: ${assetInProfitUsd} gasFeeUsd: ${gasFeeUsd}. Skipping step ${i}...`
            );
            continue;
          }
        } catch (error) {
          console.error(`Error simulating gas fee and calculating profitability for ${leverageToken}. Error: ${error}`);
          throw error;
        }
      }

      console.log(
        `Rebalance is profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} assetOut: ${assetOut}. amountIn: ${requiredAmountIn} assetIn: ${assetIn}. Participating in Dutch auction...`
      );

      try {
        // Will throw an error if reverts
        const { request: simulationRequest } = await dutchAuctionRebalancerContract.simulate.takeAuction([
          rebalanceAdapter,
          assetIn,
          assetOut,
          takeAmount,
          CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
          swapParams.swapCalls
        ]);

        const tx = await dutchAuctionRebalancerContract.write.takeAuction([
          rebalanceAdapter,
          assetIn,
          assetOut,
          takeAmount,
          CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
          swapParams.swapCalls
        ], {
          gas: simulationRequest.gas ? getPaddedGas(simulationRequest.gas) : undefined,
        });

        console.log(`takeAuction transaction submitted for LeverageToken ${leverageToken}. Pending transaction hash: ${tx}`);

        let receipt: WaitForTransactionReceiptReturnType;
        try {
          receipt = await publicClient.waitForTransactionReceipt({
            hash: tx,
            timeout: TAKE_AUCTION_TIMEOUT
          });
        } catch (error) {
          if (error instanceof WaitForTransactionReceiptTimeoutError) {
            await sendAlert(`*Timeout while waiting for takeAuction transaction receipt for LeverageToken ${leverageToken}*\n• Transaction Hash: \`${tx}\``, LogLevel.ERROR);
            console.error(`Timeout while waiting for takeAuction transaction receipt for LeverageToken ${leverageToken}. Transaction hash: ${tx}`);

            // We continue trying to take the auction if waiting for the transaction receipt timed out
            continue;
          }

          console.error(`Error waiting for takeAuction transaction receipt for LeverageToken ${leverageToken}. Error: ${error}`);
          throw error;
        }

        if (receipt.status === "reverted") {
          const errorString = `Transaction to take auction for LeverageToken ${leverageToken} reverted. takeAmount: ${takeAmount}. Transaction hash: ${tx}`;
          await sendAlert(`*Error submitting takeAuction transaction*\n${errorString}`, LogLevel.ERROR);
          console.error(errorString);

          // We continue trying to take the auction with the next step, since it's likely that the transaction reverted
          // due to the max take amount decreasing during on-chain execution because of borrow interest or redemptions
          // between the simulation / gas estimation and the takeAuction transaction execution.
          continue;
        }

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
            const errorName = revertError.data?.errorName;
            if (errorName === "InvalidLeverageTokenStateAfterRebalance") {
              console.log(
                `Auction taken for LeverageToken ${leverageToken} but failed due to invalid leverage token state post rebalance due to stale state.`
              );
            } else if (errorName === "AuctionNotValid") {
              console.log(
                `Auction taken for LeverageToken ${leverageToken} but failed due to auction not being valid. Closing interval...`
              );
              clearDutchAuctionInterval(leverageToken);
            } else {
              console.error(`ContractFunctionRevertedError taking auction for LeverageToken ${leverageToken}. Error: ${error}`);
              throw error;
            }
          } else {
            console.error(`Error taking auction for LeverageToken ${leverageToken}. Error: ${error}`);
            throw error;
          }
        } else {
          console.error(`Error taking auction for LeverageToken ${leverageToken}. Error: ${error}`);
          throw error;
        }
      }
    }
  } catch (error) {
    console.error(`Error handling auction event for LeverageToken ${leverageToken}. Error: ${error}`);
    sendAlert(`*Unhandled error in handleAuctionCreatedEvent for LeverageToken ${leverageToken}*\n• Error: \`${error}\``, LogLevel.ERROR);
    throw error;
  }
};

const simulateAndCalculateProfitability = async (
  pricers: Pricer[],
  rebalanceAdapter: Address,
  assetIn: Address,
  assetInDecimals: number,
  assetOut: Address,
  takeAmount: bigint,
  swapParams: GetRebalanceSwapParamsOutput,
  requiredAmountIn: bigint
): Promise<{ isProfitableWithGasFee: boolean, errorFetchingPrices: boolean, assetInProfitUsd: number, gasFeeUsd: number }> => {

  let gas: bigint | undefined;
  let maxFeePerGas: bigint | undefined;
  let gasPrice: bigint | undefined;
  if (!IS_USING_FORK) {
    const { request } = await dutchAuctionRebalancerContract.simulate.takeAuction([
      rebalanceAdapter,
      assetIn,
      assetOut,
      takeAmount,
      CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
      swapParams.swapCalls
    ]);
    ({ gas, maxFeePerGas, gasPrice } = request);
  } else {
    maxFeePerGas = 1000000000n; // 1 gwei
    gasPrice = maxFeePerGas;

    const simulation = await tenderlySimulateTransaction(walletClient, [
      {
        from: walletClient.account.address,
        to: CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER,
        gas: "0x0",
        gasPrice: toHex(maxFeePerGas),
        value: "0x0",
        data: encodeFunctionData({
          abi: DutchAuctionRebalancerAbi,
          functionName: "takeAuction",
          args: [rebalanceAdapter, assetIn, assetOut, takeAmount, CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR, swapParams.swapCalls],
        }),
      },
      "latest",
    ]);
    gas = hexToBigInt(simulation.trace[0].gasUsed);
  }

  const gasEstimate = gas ?? 0n;
  const paddedGas = getPaddedGas(gasEstimate);

  // Price per unit (prioritize EIP-1559, then legacy)
  const perGasCap =
    maxFeePerGas ??
    gasPrice ??
    0n;

  const maxFeeWei = paddedGas * perGasCap;

  const assetInUsdPrice = await pricers[0].price(assetIn);
  const ethUsdPrice = await pricers[0].price(CONTRACT_ADDRESSES[CHAIN_ID].WETH);

  if (assetInUsdPrice === undefined) {
    console.error(`Failed to get usd price for asset ${assetIn}`);
    await sendAlert(`Failed to get usd price for asset ${assetIn}`, LogLevel.ERROR);
    return { isProfitableWithGasFee: false, errorFetchingPrices: true, assetInProfitUsd: 0, gasFeeUsd: 0 };
  }

  if (ethUsdPrice === undefined) {
    console.error(`Failed to get usd price for ETH`);
    await sendAlert(`Failed to get usd price for ETH`, LogLevel.ERROR);
    return { isProfitableWithGasFee: false, errorFetchingPrices: true, assetInProfitUsd: 0, gasFeeUsd: 0 };
  }

  const gasFeeUsd = Number(formatEther(maxFeeWei)) * ethUsdPrice;

  const assetInProfit = Number(formatUnits(swapParams.amountOut - requiredAmountIn, assetInDecimals));

  const assetInProfitUsd = assetInProfit * assetInUsdPrice;

  return { isProfitableWithGasFee: assetInProfitUsd > gasFeeUsd, errorFetchingPrices: false, assetInProfitUsd, gasFeeUsd };
};

const subscribeToAuctionCreated = (lendingAdapter: Address, rebalanceAdapter: Address, pricers: Pricer[]) => {
  console.log(`Listening for AuctionCreated events on RebalanceAdapter ${rebalanceAdapter}...`);

  publicClient.watchContractEvent({
    address: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onError: error => console.error(error),
    onLogs: () => {
      // A new dutch auction interval is created when AuctionCreated events are received
      console.log(`AuctionCreated event received for LeverageToken ${getLeverageTokenForRebalanceAdapter(rebalanceAdapter)}. Starting new dutch auction interval...`);
      startNewDutchAuctionInterval(lendingAdapter, rebalanceAdapter, pricers);
    },
  });
};

export const getDutchAuctionInterval = (leverageToken: Address) => {
  return DUTCH_AUCTION_ACTIVE_INTERVALS.get(leverageToken);
};

const clearDutchAuctionInterval = (leverageToken: Address) => {
  const currentInterval = getDutchAuctionInterval(leverageToken);

  if (currentInterval) {
    DUTCH_AUCTION_ACTIVE_INTERVALS.delete(leverageToken);
    clearInterval(currentInterval);
  }
};

export const startNewDutchAuctionInterval = (lendingAdapter: Address, rebalanceAdapter: Address, pricers: Pricer[]) => {
  const leverageToken = getLeverageTokenForRebalanceAdapter(rebalanceAdapter);
  const collateralAsset = getLeverageTokenCollateralAsset(leverageToken);
  const debtAsset = getLeverageTokenDebtAsset(leverageToken);

  // If there is an interval that is already running, clear it
  clearDutchAuctionInterval(leverageToken);

  const interval = setInterval(async () => {
    const lock = getDutchAuctionLock(leverageToken, interval);

    let leaseOwner: symbol;
    try {
      leaseOwner = lock.acquire();
    } catch (error) {
      console.log(`Lock for Dutch auction interval for LeverageToken ${leverageToken} is occupied. Skipping interval execution...`);
      return;
    }

    try {
      await handleAuctionCreatedEvent(leverageToken, lendingAdapter, rebalanceAdapter, collateralAsset, debtAsset, pricers);
    } finally {
      lock.release(leaseOwner);
    }
  }, DUTCH_AUCTION_POLLING_INTERVAL);

  DUTCH_AUCTION_ACTIVE_INTERVALS.set(leverageToken, interval);
}

export const subscribeToAllAuctionCreatedEvents = (pricers: Pricer[]) => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  console.log(`Leverage tokens: ${leverageTokens.length}`);
  console.log(`LEVERAGE_TOKENS_FILE_PATH: ${LEVERAGE_TOKENS_FILE_PATH}`);
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    const lendingAdapter = getLeverageTokenLendingAdapter(leverageToken.address);
    subscribeToAuctionCreated(lendingAdapter, rebalanceAdapter, pricers);
  });
};
