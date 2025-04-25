import { Abi, Address, Log, Chain as ViemChain } from "viem";

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
  UNISWAP_V2_ROUTER_02: Address;
}

export interface LeverageToken {
  address: Address;
  collateralAsset: Address;
  debtAsset: Address;
  rebalanceAdapter: Address;
}

export interface UniswapV2GetAmountsOutArgs {
  inputTokenAddress: Address;
  outputTokenAddress: Address;
  amountInRaw: string;
}

export interface UniswapV3QuoteExactInputArgs {
  tokenInAddress: Address;
  tokenInDecimals: number;
  tokenOutAddress: Address;
  tokenOutDecimals: number;
  amountInRaw: string;
  slippageTolerance: Percent;
  deadline: number;
  recipient: Address;
}

export interface WebSocketConfig {
  contractAddress: string;
  abi: Abi;
  eventName: string;
  onEvent: (event: Log) => void;
}
