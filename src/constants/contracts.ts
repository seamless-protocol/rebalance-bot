import { Address, zeroAddress } from "viem";
import { ContractAddresses } from "../types";

import dotenv from "dotenv";

dotenv.config();

export const CONTRACT_ADDRESSES: ContractAddresses = {
  ETHERFI_L2_MODE_SYNC_POOL: (process.env.ETHERFI_L2_MODE_SYNC_POOL as Address) || zeroAddress,
  LEVERAGE_MANAGER: (process.env.LEVERAGE_MANAGER as Address) || zeroAddress,
  DUTCH_AUCTION_REBALANCER: (process.env.DUTCH_AUCTION_REBALANCER as Address) || zeroAddress,
  MULTICALL_EXECUTOR: (process.env.MULTICALL_EXECUTOR as Address) || zeroAddress,
  PRE_LIQUIDATION_REBALANCER: (process.env.PRE_LIQUIDATION_REBALANCER as Address) || zeroAddress,
  UNISWAP_SWAP_ROUTER_02: (process.env.UNISWAP_SWAP_ROUTER_02 as Address) || zeroAddress,
  UNISWAP_V2_ROUTER_02: (process.env.UNISWAP_V2_ROUTER_02 as Address) || zeroAddress,
  WETH: (process.env.WETH as Address) || zeroAddress,
  WEETH: (process.env.WEETH as Address) || zeroAddress,
};
