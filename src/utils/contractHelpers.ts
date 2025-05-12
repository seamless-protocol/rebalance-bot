import { Abi, AbiEvent, Address, Log, getAbiItem, getContract } from "viem";
import { publicClient, walletClient } from "./transactionHelpers";

import { CONTRACT_ADDRESSES } from "../constants/contracts";
import EtherFiL2ModeSyncPoolAbi from "../../abis/EtherFiL2ModeSyncPool";
import { LEVERAGE_TOKENS_FILE_PATH } from "../constants/chain";
import { LeverageManagerAbi } from "../../abis/LeverageManager";
import { readJsonArrayFromFile } from "./fileHelpers";
import rebalanceAdapterAbi from "../../abis/RebalanceAdapter";
import rebalancerAbi from "../../abis/Rebalancer";
import uniswapV2Router02Abi from "../../abis/UniswapV2Router02";

export const getHistoricalLogs = async ({
  contractAddress,
  abi,
  eventName,
  fromBlock,
  toBlock,
}: {
  contractAddress: Address;
  abi: Abi;
  eventName: string;
  fromBlock: number;
  toBlock?: number;
}): Promise<Log[]> => {
  const event = getAbiItem({
    abi,
    name: eventName,
  }) as AbiEvent;

  if (!event) {
    throw new Error(`Event ${eventName} not found in ABI`);
  }

  const logs = await publicClient.getLogs({
    address: contractAddress,
    event,
    fromBlock: BigInt(fromBlock),
    toBlock: toBlock !== undefined ? BigInt(toBlock) : undefined,
  });

  console.log(
    `Found ${logs.length} logs for event ${eventName} from block ${fromBlock} to block ${toBlock !== undefined ? toBlock : "latest"}`
  );

  return logs;
};

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

export const getLeverageTokenForRebalanceAdapter = (rebalanceAdapter: Address): Address => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH);

  const leverageToken = leverageTokens.find((token) => token.rebalanceAdapter === rebalanceAdapter);

  if (!leverageToken) {
    throw new Error(`No leverage token found for rebalance adapter ${rebalanceAdapter}`);
  }

  return leverageToken.address;
};

export const getLeverageTokenCollateralAsset = (leverageToken: Address): Address => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH);
  const token = leverageTokens.find((token) => token.address === leverageToken);

  if (!token) {
    throw new Error(`No collateral asset found for leverage token ${leverageToken}`);
  }

  return token.collateralAsset;
};

export const getLeverageTokenDebtAsset = (leverageToken: Address): Address => {
  const leverageTokens = readJsonArrayFromFile(LEVERAGE_TOKENS_FILE_PATH);
  const token = leverageTokens.find((token) => token.address === leverageToken);

  if (!token) {
    throw new Error(`No debt asset found for leverage token ${leverageToken}`);
  }

  return token.debtAsset;
};

export const getUniswapV2Router02Contract = () => {
  return getContract({
    address: CONTRACT_ADDRESSES.UNISWAP_V2_ROUTER_02,
    abi: uniswapV2Router02Abi,
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
  abi: LeverageManagerAbi,
  client: walletClient,
});

export const getEtherFiL2ModeSyncPoolContract = () => {
  return getContract({
    address: CONTRACT_ADDRESSES.ETHERFI_L2_MODE_SYNC_POOL,
    abi: EtherFiL2ModeSyncPoolAbi,
    client: publicClient,
  });
};
