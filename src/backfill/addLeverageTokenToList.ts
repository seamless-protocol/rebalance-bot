import { Address } from "viem";
import { LendingAdapterAbi } from "../../abis/LendingAdapterAbi";
import { LeverageManagerAbi } from "../../abis/LeverageManager";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { leverageManagerContract } from "../utils/contractHelpers";
import { appendObjectToJsonFile, readJsonArrayFromFile } from "../utils/fileHelpers";
import { publicClient } from "../utils/transactionHelpers";

/**
 * Adds a leverage token to the list of leverage tokens that this bot should monitor and starts listening for auction created events on rebalance adapter
 * @dev Usage: npm run backfill:add-leverage-token <leverageTokenAddress>
 * @param leverageToken The address of the leverage token
 * @dev This function fetches the lending adapter, rebalance adapter, collateral asset and debt asset for the given leverage token
 * @dev Finally, it appends the leverage token to the list of leverage tokens
 */
export const addLeverageTokenToList = async (leverageToken: Address) => {
  console.log(`Adding leverage token ${leverageToken} to the list...`);

  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH);

  if (leverageTokens.find((token) => token.address === leverageToken)) {
    console.warn(`Leverage token ${leverageToken} already exists in the list`);
    return;
  }

  const { lendingAdapter, rebalanceAdapter } = await fetchLeverageTokenAdapters(leverageToken);
  const { collateralAsset, debtAsset } = await fetchCollateralAndDebtAssets(lendingAdapter);

  appendObjectToJsonFile(LEVERAGE_TOKENS_FILE_PATH, {
    address: leverageToken,
    collateralAsset,
    debtAsset,
    rebalanceAdapter,
    lendingAdapter,
  });
};

/**
 * Fetches the lending adapter and rebalance adapter for a given leverage token
 * @param leverageToken The address of the leverage token
 * @returns The lending adapter and rebalance adapter for the given leverage token
 * @dev Lending adapter and rebalance adapter are fetched with multicall to avoid multiple calls to the rpc
 * @dev If some of this 2 calls fail, the function will throw an error
 */
const fetchLeverageTokenAdapters = async (
  leverageToken: Address
): Promise<{ lendingAdapter: Address; rebalanceAdapter: Address }> => {
  const [lendingAdapterResponse, rebalanceAdapterResponse] = await publicClient.multicall({
    contracts: [
      {
        address: leverageManagerContract.address,
        abi: LeverageManagerAbi,
        functionName: "getLeverageTokenLendingAdapter",
        args: [leverageToken],
      },
      {
        address: leverageManagerContract.address,
        abi: LeverageManagerAbi,
        functionName: "getLeverageTokenRebalanceAdapter",
        args: [leverageToken],
      },
    ],
  });

  if (lendingAdapterResponse.error || rebalanceAdapterResponse.error) {
    throw new Error(`Lending adapter or rebalance adapter not found for leverage token ${leverageToken}`);
  }

  return {
    lendingAdapter: lendingAdapterResponse.result,
    rebalanceAdapter: rebalanceAdapterResponse.result,
  };
};

/**
 * Fetches the collateral and debt assets for a given lending adapter
 * @param lendingAdapter The address of the lending adapter
 * @returns The collateral and debt assets for the given lending adapter
 * @dev Collateral and debt assets are fetched with multicall to avoid multiple calls to the rpc
 * @dev If some of this 2 calls fail, the function will throw an error
 */
export const fetchCollateralAndDebtAssets = async (
  lendingAdapter: Address
): Promise<{ collateralAsset: Address; debtAsset: Address }> => {
  const [collateralAssetResponse, debtAssetResponse] = await publicClient.multicall({
    contracts: [
      {
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getCollateralAsset",
      },
      {
        address: lendingAdapter,
        abi: LendingAdapterAbi,
        functionName: "getDebtAsset",
      },
    ],
  });

  if (collateralAssetResponse.error || debtAssetResponse.error) {
    throw new Error(`Collateral asset or debt asset not found on lending adapter ${lendingAdapter}`);
  }

  return {
    collateralAsset: collateralAssetResponse.result,
    debtAsset: debtAssetResponse.result,
  };
};
