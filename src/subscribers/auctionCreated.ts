import { Address, BaseError, ContractFunctionRevertedError, isAddressEqual } from "viem";
import {
  BASE_RATIO,
  DUTCH_AUCTION_ACTIVE_INTERVALS,
  DUTCH_AUCTION_POLLING_INTERVAL,
  DUTCH_AUCTION_STEP_COUNT,
} from "../constants/values";
import { getRebalanceSwapParams } from "../services/routing/getSwapParams";
import { LeverageToken, LogLevel, RebalanceType, StakeType } from "../types";
import {
  dutchAuctionRebalancerContract,
  getLeverageTokenCollateralAsset,
  getLeverageTokenDebtAsset,
  getLeverageTokenForRebalanceAdapter,
  getLeverageTokenLendingAdapter,
  getLeverageTokenRebalanceAdapter,
  leverageManagerContract,
} from "../utils/contractHelpers";

import { LeverageManagerAbi } from "../../abis/LeverageManager";
import RebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import { CHAIN_ID,LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { sendAlert } from "../utils/alerts";
import { readJsonArrayFromFile } from "../utils/fileHelpers";
import { publicClient } from "../utils/transactionHelpers";
import { DutchAuctionRebalancerAbi } from "../../abis/DutchAuctionRebalancer";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";

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
  if (isAddressEqual(collateralAsset, CONTRACT_ADDRESSES[CHAIN_ID].WEETH) && isAddressEqual(debtAsset, CONTRACT_ADDRESSES[CHAIN_ID].WETH) && isOverCollateralized) {
    return StakeType.ETHERFI_ETH_WEETH;
  } if (isAddressEqual(collateralAsset, CONTRACT_ADDRESSES[CHAIN_ID].WSTETH as Address) && isAddressEqual(debtAsset, CONTRACT_ADDRESSES[CHAIN_ID].WETH as Address) && isOverCollateralized) {
    return StakeType.LIDO_ETH_WSTETH;
  }
  return StakeType.NONE;
};

export const handleAuctionCreatedEvent = async (
  leverageToken: Address,
  lendingAdapter: Address,
  rebalanceAdapter: Address,
  collateralAsset: Address,
  debtAsset: Address
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

      const [requiredAmountIn, [isAuctionValid, newCollateralRatio]] = await Promise.all([
        publicClient.readContract({
          address: rebalanceAdapter,
          abi: RebalanceAdapterAbi,
          functionName: "getAmountIn",
          args: [takeAmount],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER,
          abi: DutchAuctionRebalancerAbi,
          functionName: "previewTakeAuction",
          args: [leverageToken, takeAmount, rebalanceType],
        }),
      ]);

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
          `Rebalance is not profitable for LeverageToken ${leverageToken}. takeAmount: ${takeAmount} assetOut: ${assetOut}. amountIn: ${requiredAmountIn} assetIn: ${assetIn}. Skipping step ${i}...`
        );
        continue;
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

export const subscribeToAuctionCreated = (lendingAdapter: Address, rebalanceAdapter: Address) => {
  console.log(`Listening for AuctionCreated events on RebalanceAdapter ${rebalanceAdapter}...`);

  publicClient.watchContractEvent({
    address: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    eventName: "AuctionCreated",
    onError: error => console.error(error),
    onLogs: () => {
      startDutchAuctionInterval(lendingAdapter, rebalanceAdapter);
    },
  });
};

export const startDutchAuctionInterval = (lendingAdapter: Address, rebalanceAdapter: Address) => {
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
    await handleAuctionCreatedEvent(leverageToken, lendingAdapter, rebalanceAdapter, collateralAsset, debtAsset);
  }, DUTCH_AUCTION_POLLING_INTERVAL);

  DUTCH_AUCTION_ACTIVE_INTERVALS.set(rebalanceAdapter, interval);
}

export const subscribeToAllAuctionCreatedEvents = () => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH) as LeverageToken[];
  console.log(`Leverage tokens: ${leverageTokens.length}`);
  console.log(`LEVERAGE_TOKENS_FILE_PATH: ${LEVERAGE_TOKENS_FILE_PATH}`);
  leverageTokens.forEach((leverageToken) => {
    const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken.address);
    const lendingAdapter = getLeverageTokenLendingAdapter(leverageToken.address);
    subscribeToAuctionCreated(lendingAdapter, rebalanceAdapter);
  });
};
