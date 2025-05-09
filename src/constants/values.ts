import { Address, parseEther } from "viem";

import dotenv from "dotenv";

dotenv.config();

// Map of active intervals that are trying to take on dutch auction for specific rebalance adapter
export const DUTCH_AUCTION_ACTIVE_INTERVALS = new Map<Address, any>();

export const BASE_RATIO = parseEther("1");
export const DEFAULT_DUTCH_AUCTION_STEP_COUNT = Number(process.env.DUTCH_AUCTION_STEP_COUNT) || 10;
export const DUTCH_AUCTION_POLLING_INTERVAL = Number(process.env.DUTCH_AUCTION_POLLING_INTERVAL) || 10000;

export const LIFI_API_URL = "https://li.quest/v1/quote";
