import { getContract, Address } from "viem";
import { walletClient } from "../config/viemConfig";
import { readJsonArrayFromFile } from "./fileHelpers";
import { CONTRACT_ADDRESSES } from "../constants/contracts";
import leverageManagerAbi from "../../abis/LeverageManager";
import rebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import rebalancerAbi from "../../abis/Rebalancer";
import path from "path";

// Gets address of rebalance adapter for a given leverage token from JSON file not from chain
export function getLeverageTokenRebalanceAdapter(leverageToken: Address): Address {
  const leverageTokens = readJsonArrayFromFile(path.join(__dirname, "../data/leverageTokens.json"));

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
  address: CONTRACT_ADDRESSES.BASE.REBALANCER,
  abi: rebalancerAbi,
  client: walletClient,
});

export const leverageManagerContract = getContract({
  address: CONTRACT_ADDRESSES.BASE.LEVERAGE_MANAGER,
  abi: leverageManagerAbi,
  client: walletClient,
});
