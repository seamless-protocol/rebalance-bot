import { extractChain } from "viem";
import { mainnet, base } from "viem/chains";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const CHAIN_ID = Number(process.env.CHAIN_ID) || 1;
export const LEVERAGE_TOKENS_FILE_PATH = path.join(__dirname, "..", "data", "leverageTokens.json");
export const REBALANCE_ELIGIBILITY_POLL_INTERVAL = parseInt(
  process.env.REBALANCE_ELIGIBILITY_POLL_INTERVAL || "90000", // 90 seconds default
  10
);
export const PRIMARY_RPC_URL = process.env.PRIMARY_RPC_URL || "";
export const PRIMARY_RPC_URL_WS = process.env.PRIMARY_RPC_URL_WS || "";
export const FALLBACK_RPC_URL = process.env.FALLBACK_RPC_URL || "";
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
export const MAINNET_RPC_URL = process.env.ETHEREUM_MAINNET_RPC_URL || "";
export const MAINNET_FALLBACK_RPC_URL = process.env.ETHEREUM_MAINNET_FALLBACK_RPC_URL || "";
export const VIEM_CHAIN = extractChain({ chains: [mainnet, base], id: CHAIN_ID as any });
