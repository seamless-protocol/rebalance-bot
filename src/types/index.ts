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

export interface LeverageTokenState {
  collateralInDebtAsset: bigint;
  debt: bigint;
  equity: bigint;
  collateralRatio: bigint;
}
