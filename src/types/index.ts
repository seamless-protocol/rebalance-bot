import { Address, Chain as ViemChain } from "viem";

export interface Chain {
  chainId: number;
  leverageTokensFilePath: string;
  rpcUrl: string;
  viemChain: ViemChain;
}

export interface ContractAddresses {
  LEVERAGE_MANAGER: Address;
}

export interface LeverageToken {
  address: Address;
  collateralAsset: Address;
  debtAsset: Address;
  rebalanceAdapter: Address;
}
