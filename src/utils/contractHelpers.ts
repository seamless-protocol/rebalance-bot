import { Address, getContract } from "viem";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import leverageManagerAbi from "../../abis/LeverageManager";
import { readJsonArrayFromFile } from "./fileHelpers";
import rebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import rebalancerAbi from "../../abis/Rebalancer";
import { walletClient } from "./transactionHelpers";

// Gets address of rebalance adapter for a given leverage token from JSON file not from chain
export function getLeverageTokenRebalanceAdapter(leverageToken: Address): Address {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH);

  // Find address of leverage token in JSON file by searching for it
  const rebalanceAdapter = leverageTokens.find((token) => token.address === leverageToken)?.rebalanceAdapter;

  // If no rebalance adapter is found, throw an error, we don't want to return undefined
  if (!rebalanceAdapter) {
    throw new Error(`No rebalance adapter found for leverage token ${leverageToken}`);
  }

  return rebalanceAdapter;
}

// Gets rebalance adapter contract for a given leverage token
export const getLeverageTokenRebalanceAdapterContract = (leverageToken: Address) => {
  // Gets address from JSON file and wrap it into proper contract instance
  return getContract({
    address: getLeverageTokenRebalanceAdapter(leverageToken),
    abi: rebalanceAdapterAbi,
    client: walletClient,
  });
};

export const rebalancerContract = getContract({
  address: CONTRACT_ADDRESSES.REBALANCER,
  abi: rebalancerAbi,
  client: walletClient,
});

export const leverageManagerContract = getContract({
  address: CONTRACT_ADDRESSES.LEVERAGE_MANAGER,
  abi: leverageManagerAbi,
  client: walletClient,
});
