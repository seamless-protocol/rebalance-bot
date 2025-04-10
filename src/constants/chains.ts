import { Chain } from "../types";
import { base } from "viem/chains";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const CHAIN_IDS: Record<string, number> = {
  BASE: 8453,
};

export const CHAIN_RPC_URLS: Record<string, string> = {
  BASE: process.env.BASE_RPC_URL || "",
};

export const CHAINS: Chain[] = [
  {
    chainId: CHAIN_IDS.BASE,
    leverageTokensFilePath: path.join(__dirname, "..", "data", CHAIN_IDS.BASE.toString(), "leverageTokens.json"),
    rebalanceEligibilityPollInterval: parseInt(process.env.BASE_REBALANCE_ELIGIBILITY_POLL_INTERVAL || "90000", 10),
    rpcUrl: CHAIN_RPC_URLS.BASE,
    viemChain: base,
  },
];
