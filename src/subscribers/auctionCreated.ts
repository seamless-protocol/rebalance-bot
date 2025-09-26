import { Address, BaseError, ContractFunctionRevertedError, erc20Abi, formatEther, formatUnits, encodeFunctionData, toHex, hexToBigInt } from "viem";
import {
  BASE_RATIO,
  DUTCH_AUCTION_ACTIVE_INTERVALS,
  DUTCH_AUCTION_POLLING_INTERVAL,
  DUTCH_AUCTION_STEP_COUNT,
  IS_USING_FORK,
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
import { publicClient, walletClient } from "../utils/transactionHelpers";
import { Pricer } from "../services/pricers/pricer";

const getLeverageTokenRebalanceData = async (leverageToken: Address, lendingAdapter: Address, rebalanceAdapter: Address) => {
  const [leverageTokenStateResponse, collateralResponse, equityInCollateralAssetResponse, targetRatioResponse, isAuctionValidResponse] = await publicClient.multicall({
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
    ],
  });

  if (
    leverageTokenStateResponse?.result == undefined ||
    collateralResponse?.result == undefined ||
    equityInCollateralAssetResponse?.result == undefined ||
    targetRatioResponse?.result == undefined ||
    isAuctionValidResponse?.result == undefined
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
  };
};

const getStakeType = (collateralAsset: Address, debtAsset: Address, isOverCollateralized: boolean) => {
  // Determine whether we can use native EtherFi staking for swapping assets
  if (collateralAsset.toLowerCase() == CONTRACT_ADDRESSES[CHAIN_ID].WEETH.toLowerCase() && debtAsset.toLowerCase() == CONTRACT_ADDRESSES[CHAIN_ID].WETH.toLowerCase() && isOverCollateralized) {
    return StakeType.ETHERFI_ETH_WEETH;
  }
  return StakeType.NONE;
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
    const { collateral, debt, equityInDebtAsset, equityInCollateralAsset, currentRatio, targetRatio, isAuctionValid } = await getLeverageTokenRebalanceData(
      leverageToken,
      lendingAdapter,
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
    const targetCollateral = (equityInCollateralAsset * targetRatio) / (targetRatio - baseRatio);
    const targetDebt = (equityInDebtAsset * baseRatio) / (targetRatio - baseRatio);

    // Calculate what is max amount to take to bring LT to target debt or target collateral
    // If strategy is over-collateralized we are adding collateral and borrowing debt
    // If strategy is under-collateralized we are repaying debt and removing collateral
    const assetIn = isOverCollateralized ? collateralAsset : debtAsset;
    const assetOut = isOverCollateralized ? debtAsset : collateralAsset;
    const maxAmountToTake = isOverCollateralized ? targetDebt - debt : collateral - targetCollateral;

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
        console.log(`Auction is no longer valid for LeverageToken ${leverageToken}. Closing interval...`);

        const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
        DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
        clearInterval(interval);

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
        console.error(`Error simulating and calculating profitability for ${leverageToken}. Error: ${error}`);
        throw error;
      }

      console.log(
        `Rebalance is profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} assetOut: ${assetOut}. amountIn: ${requiredAmountIn} assetIn: ${assetIn}. Participating in Dutch auction...`
      );

      try {
        const tx = await dutchAuctionRebalancerContract.write.takeAuction([
          rebalanceAdapter,
          assetIn,
          assetOut,
          takeAmount,
          CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
          swapParams.swapCalls
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
            const errorName = revertError.data?.errorName;
            if (errorName === "InvalidLeverageTokenStateAfterRebalance") {
              console.log(
                `Auction taken for LeverageToken ${leverageToken} but failed due to invalid leverage token state post rebalance due to stale state. Closing interval...`
              );
              const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
              DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
              clearInterval(interval);
            } else if (errorName === "AuctionNotValid") {
              console.log(
                `Auction taken for LeverageToken ${leverageToken} but failed due to auction not being valid. Closing interval...`
              );
              const interval = DUTCH_AUCTION_ACTIVE_INTERVALS.get(rebalanceAdapter);
              DUTCH_AUCTION_ACTIVE_INTERVALS.delete(rebalanceAdapter);
              clearInterval(interval);
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
  const paddedGas = (gasEstimate * 11n) / 10n; // +10% padding

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
      startDutchAuctionInterval(lendingAdapter, rebalanceAdapter, pricers);
    },
  });
};

export const startDutchAuctionInterval = (lendingAdapter: Address, rebalanceAdapter: Address, pricers: Pricer[]) => {
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
    await handleAuctionCreatedEvent(leverageToken, lendingAdapter, rebalanceAdapter, collateralAsset, debtAsset, pricers);
  }, DUTCH_AUCTION_POLLING_INTERVAL);

  DUTCH_AUCTION_ACTIVE_INTERVALS.set(rebalanceAdapter, interval);
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
