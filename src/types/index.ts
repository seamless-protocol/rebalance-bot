import { Abi, Address, Log, Chain as ViemChain } from "viem";

export enum RebalanceStatus {
  NOT_ELIGIBLE = 0,
  DUTCH_AUCTION_ELIGIBLE = 1,
  PRE_LIQUIDATION_ELIGIBLE = 2,
}

export enum StakeType {
  NONE = 0,
  ETHERFI_ETH_WEETH = 1,
  LIDO_ETH_WSTETH = 2,
}

export enum RebalanceType {
  REBALANCE_DOWN = 0,
  REBALANCE_UP = 1,
}

export enum LogLevel {
  INFO = 0,
  ERROR = 1,
  REBALANCED = 2,
}

export interface Chain {
  chainId: number;
  leverageTokensFilePath: string;
  rebalanceEligibilityPollInterval: number;
  rpcUrl: string;
  viemChain: ViemChain;
}

export interface ContractAddresses {
  DUTCH_AUCTION_REBALANCER: Address;
  EETH?: Address;
  ETHERFI_DEPOSIT_ADAPTER?: Address;
  ETHERFI_L2_MODE_SYNC_POOL?: Address;
  ETHERFI_LIQUIDITY_POOL?: Address;
  LEVERAGE_MANAGER: Address;
  MULTICALL_EXECUTOR: Address;
  PRE_LIQUIDATION_REBALANCER: Address;
  WSTETH?: Address;
  UNISWAP_SWAP_ROUTER_02: Address;
  UNISWAP_V2_ROUTER_02: Address;
  WETH: Address;
  WEETH: Address;
}

export interface LeverageToken {
  address: Address;
  collateralAsset: Address;
  debtAsset: Address;
  rebalanceAdapter: Address;
  lendingAdapter: Address;
}

export interface PendingTakeAuctionTransaction {
  hash: string;
  timestamp: number;
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

export interface StakeContext {
  stakeType: StakeType;
  stakeTo: Address;
  assetIn: Address;
  amountIn: bigint;
}

export interface GetRebalanceSwapParamsInput {
  stakeType: StakeType;
  assetIn: Address;
  assetOut: Address;
  takeAmount: bigint;
  requiredAmountIn: bigint;
}

export interface Call {
  target: Address;
  data: `0x${string}`;
  value: bigint;
}

export interface GetRebalanceSwapParamsOutput {
  isProfitable: boolean;
  amountOut: bigint;
  swapCalls: Call[];
}

export interface GetLIFIQuoteInput {
  fromToken: Address;
  toToken: Address;
  fromAmount: bigint;
}

export interface GetLIFIQuoteOutput {
  amountOut: bigint;
  to: Address;
  data: `0x${string}`;
  value: bigint;
}

export interface LeverageTokenRebalanceData {
  collateral: bigint;
  collateralInDebtAsset: bigint;
  equity: bigint;
  targetRatio: bigint;
}
