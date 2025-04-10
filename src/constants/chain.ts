import { base } from "viem/chains";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const CHAIN = {
  chainId: 8453,
  leverageTokensFilePath: path.join(__dirname, "..", "data", "leverageTokens.json"),
  rebalanceEligibilityPollInterval: parseInt(process.env.BASE_REBALANCE_ELIGIBILITY_POLL_INTERVAL || "90000", 10),
  rpcUrl: process.env.BASE_RPC_URL || "",
  viemChain: base,
};
