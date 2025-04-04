import { Chain } from "../types";
import { Network } from "alchemy-sdk";
import { base } from "viem/chains";

export const CHAIN_IDS: Record<string, number> = {
  BASE: 8453,
};

export const CHAIN_RPC_URLS: Record<string, string> = {
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
