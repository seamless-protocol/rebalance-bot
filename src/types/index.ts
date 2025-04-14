import { Address, Log, Chain as ViemChain } from "viem";

import { Percent } from "@uniswap/sdk-core";

export enum RebalanceStatus {
  NOT_ELIGIBLE = 0,
  DUTCH_AUCTION_ELIGIBLE = 1,
  PRE_LIQUIDATION_ELIGIBLE = 2,
}

export interface Chain {
  chainId: number;
  leverageTokensFilePath: string;
  rebalanceEligibilityPollInterval: number;
  rpcUrl: string;
  viemChain: ViemChain;
}

export interface ContractAddresses {
  LEVERAGE_MANAGER: Address;
  REBALANCER: Address;
  UNISWAP_SWAP_ROUTER_02: Address;
}

export interface LeverageToken {
  address: Address;
  collateralAsset: Address;
  debtAsset: Address;
  rebalanceAdapter: Address;
}

export interface RebalanceEligibility {
  leverageTokenAddress: Address;
  rebalanceStatus: RebalanceStatus;
}

export interface UniswapV3QuoteExactInputArgs {
  tokenInAddress: string;
  tokenInDecimals: number;
  tokenOutAddress: string;
  tokenOutDecimals: number;
  amountInRaw: string;
  slippageTolerance: Percent;
  deadline: number;
  recipient: string;
}

export interface WebSocketConfig {
  contractAddress: string;
  abi: any;
  eventName: string;
  onEvent: (event: Log) => void;
  rpcUrl: string;
}
