import { Chain } from "../types";
import { base } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

export const CHAIN_IDS: Record<string, number> = {
  BASE: 8453,
};

export const CHAIN_RPC_URLS: Record<string, string> = {
  BASE: process.env.BASE_RPC_URL || "",
};

export const CHAINS: Record<string, Chain> = {
  BASE: {
    chainId: CHAIN_IDS.BASE,
    rpcUrl: CHAIN_RPC_URLS.BASE,
    viemChain: base,
  },
};
