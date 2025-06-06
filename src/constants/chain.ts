import { base } from "viem/chains";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const CHAIN_ID = 8453;
export const LEVERAGE_TOKENS_FILE_PATH = path.join(__dirname, "..", "data", "leverageTokens.json");
export const REBALANCE_ELIGIBILITY_POLL_INTERVAL = parseInt(
  process.env.BASE_REBALANCE_ELIGIBILITY_POLL_INTERVAL || "90000", // 90 seconds default
  10
);
export const PRIMARY_RPC_URL = process.env.BASE_PRIMARY_RPC_URL || "";
export const PRIMARY_RPC_URL_WS = process.env.BASE_PRIMARY_RPC_URL_WS || "";
export const FALLBACK_RPC_URL = process.env.BASE_FALLBACK_RPC_URL || "";
export const VIEM_CHAIN = base;
