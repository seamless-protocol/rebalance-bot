import { Address, erc20Abi, getAddress } from "viem";
import { publicClient } from "./transactionHelpers";

const TOKEN_DECIMALS = new Map<Address, number>();

export const getTokenDecimals = async (tokenAddresses: Address[]): Promise<Record<Address, number>> => {

  // Find which tokens need to be fetched
  const tokensToFetch: Address[] = [];
  const result: Record<Address, number> = {};

  for (const address of tokenAddresses) {
    const checksumAddress = getAddress(address);
    const cachedDecimals = TOKEN_DECIMALS.get(checksumAddress);
    if (cachedDecimals !== undefined) {
      result[checksumAddress] = cachedDecimals;
    } else {
      tokensToFetch.push(checksumAddress);
    }
  }

  // If all tokens are cached, return early
  if (tokensToFetch.length === 0) {
    return result;
  }

  // Fetch decimals for tokens not in cache using multicall
  const multicallResults = await publicClient.multicall({
    contracts: tokensToFetch.map((address) => ({
      address,
      abi: erc20Abi,
      functionName: "decimals",
    })),
  });

  // Process results and update cache
  for (let i = 0; i < tokensToFetch.length; i++) {
    const multicallResult = multicallResults[i];

    const decimals = multicallResult.result;
    const address = tokensToFetch[i];

    // Update cache
    TOKEN_DECIMALS.set(address, decimals as number);

    // Add to result
    result[address] = decimals as number;
  }

  return result;
};