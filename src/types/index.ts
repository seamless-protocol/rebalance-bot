import { Address, Chain as ViemChain } from "viem";

import { Network } from "alchemy-sdk";

export interface Chain {
  alchemyNetwork: Network;
  chainId: number;
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
