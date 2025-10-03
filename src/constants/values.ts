import { Address, parseEther } from "viem";
import { LeaseMutex } from "../utils/leaseMutex";

import dotenv from "dotenv";

dotenv.config();

// Map of active intervals that are trying to take on dutch auction for specific rebalance adapter
export const DUTCH_AUCTION_ACTIVE_INTERVALS = new Map<Address, any>();
export const PRE_LIQUIDATION_ACTIVE_INTERVALS = new Map<Address, any>();

export const TAKE_AUCTION_LOCKS = new Map<Address, LeaseMutex>();
export const TAKE_AUCTION_LOCK_TIMEOUT = Number(process.env.TAKE_AUCTION_LOCK_TIMEOUT) || 60000; // 1 minute by default

export const BASE_RATIO = parseEther("1");
export const DUTCH_AUCTION_STEP_COUNT = Number(process.env.DUTCH_AUCTION_STEP_COUNT) || 10;
export const DUTCH_AUCTION_POLLING_INTERVAL = Number(process.env.DUTCH_AUCTION_POLLING_INTERVAL) || 10000;

export const PRE_LIQUIDATION_STEP_COUNT = Number(process.env.PRE_LIQUIDATION_STEP_COUNT) || 10;
export const PRE_LIQUIDATION_POLLING_INTERVAL = Number(process.env.PRE_LIQUIDATION_POLLING_INTERVAL) || 10000;

export const ETHERFI_L2_MODE_SYNC_POOL_ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address;

export const LIFI_API_URL = "https://li.quest/v1/quote";
export const LIFI_API_KEY = process.env.LIFI_API_KEY || null;
export const LIFI_SLIPPAGE = Number(process.env.LIFI_SLIPPAGE) || 0.01;

export const CHECK_PROFITABILITY_WITH_GAS_FEE = Boolean(process.env.CHECK_PROFITABILITY_WITH_GAS_FEE && process.env.CHECK_PROFITABILITY_WITH_GAS_FEE.toLowerCase() === "true");

export const IS_USING_FORK = process.env.IS_USING_FORK && process.env.IS_USING_FORK.toLowerCase() === "true";
