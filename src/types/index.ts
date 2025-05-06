import { Abi, Address, Log, Chain as ViemChain } from "viem";

export enum RebalanceStatus {
  NOT_ELIGIBLE = 0,
  DUTCH_AUCTION_ELIGIBLE = 1,
  PRE_LIQUIDATION_ELIGIBLE = 2,
}

export enum SwapType {
  EXACT_INPUT_SWAP_ADAPTER = 0,
  EXACT_OUTPUT_SWAP_ADAPTER = 1,
  LIFI_SWAP = 2,
}

export enum RebalanceType {
  REBALANCE_DOWN = 0,
  REBALANCE_UP = 1,
}

export enum Exchange {
  AERODROME = 0,
  AERODROME_SLIPSTREAM = 1,
  UNISWAP_V2 = 2,
  UNISWAP_V3 = 3,
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
  tokenOutAddress: Address;
  amountInRaw: string;
}

export interface WebSocketConfig {
  contractAddress: string;
  abi: Abi;
  eventName: string;
  onEvent: (event: Log) => void;
}

export interface ExchangeAddresses {
  aerodromeRouter: Address;
  aerodromePoolFactory: Address;
  aerodromeSlipstreamRouter: Address;
  uniswapSwapRouter02: Address;
  uniswapV2Router02: Address;
}

export interface SwapContext {
  path: Address[];
  encodedPath: `0x${string}`;
  fees: number[];
  tickSpacing: number[];
  exchange: Exchange;
  exchangeAddresses: ExchangeAddresses;
}

export interface GetRebalanceSwapParamsInput {
  leverageToken: Address;
  assetIn: Address;
  assetOut: Address;
  takeAmount: bigint;
}

export interface GetRebalanceSwapParamsOutput {
  isProfitable: boolean;
  swapType: SwapType;
  swapContext: SwapContext;
}
