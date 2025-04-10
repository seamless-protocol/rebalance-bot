import { Address, Chain as ViemChain } from "viem";

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
}

export interface DutchAuctionRebalanceWorkerMessage {
  status: "done" | "error";
  error?: string;
}

export interface LeverageToken {
  address: Address;
  collateralAsset: Address;
  debtAsset: Address;
  rebalanceAdapter: Address;
}

export enum RebalanceStatus {
  NOT_ELIGIBLE = 0,
  DUTCH_ELIGIBLE = 1,
  PRE_LIQUIDATION_ELIGIBLE = 2,
}
