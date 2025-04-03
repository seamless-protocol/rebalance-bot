import { Network } from "alchemy-sdk";
import { base } from "viem/chains";

export interface Chain {
  alchemyNetwork: Network;
  chainId: number;
  rpcUrl: string;
  viemChain: any;
}

export const CHAIN_IDS = {
  BASE: 8453,
};

export const CHAIN_RPC_URLS = {
  BASE: process.env.BASE_RPC_URL || "",
};

export const CHAINS: Chain[] = [
  {
    alchemyNetwork: Network.BASE_MAINNET,
    chainId: CHAIN_IDS.BASE,
    rpcUrl: CHAIN_RPC_URLS.BASE,
    viemChain: base,
  },
];

export const findChainById = (chainId: number): Chain => {
  const chain = CHAINS.find((chain) => {
    return chain.chainId === chainId;
  });

  if (!chain) {
    throw new Error(`Failed to find chain with id ${chainId}`);
  }

  return chain;
};
