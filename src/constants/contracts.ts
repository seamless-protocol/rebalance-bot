import { Address, zeroAddress } from "viem";
import { ContractAddresses } from "../types";

import dotenv from "dotenv";

dotenv.config();

export const CONTRACT_ADDRESSES: ContractAddresses = {
  ETHERFI_L2_MODE_SYNC_POOL: (process.env.ETHERFI_L2_MODE_SYNC_POOL || zeroAddress).toLowerCase() as Address,
  LEVERAGE_MANAGER: (process.env.LEVERAGE_MANAGER || zeroAddress).toLowerCase() as Address,
  DUTCH_AUCTION_REBALANCER: (process.env.DUTCH_AUCTION_REBALANCER || zeroAddress).toLowerCase() as Address,
  EETH: (process.env.EETH || zeroAddress).toLowerCase() as Address,
  ETHERFI_DEPOSIT_ADAPTER: (process.env.ETHERFI_DEPOSIT_ADAPTER || zeroAddress).toLowerCase() as Address,
  ETHERFI_LIQUIDITY_POOL: (process.env.ETHERFI_LIQUIDITY_POOL || zeroAddress).toLowerCase() as Address,
  MULTICALL_EXECUTOR: (process.env.MULTICALL_EXECUTOR || zeroAddress).toLowerCase() as Address,
  PRE_LIQUIDATION_REBALANCER: (process.env.PRE_LIQUIDATION_REBALANCER || zeroAddress).toLowerCase() as Address,
  UNISWAP_SWAP_ROUTER_02: (process.env.UNISWAP_SWAP_ROUTER_02 || zeroAddress).toLowerCase() as Address,
  UNISWAP_V2_ROUTER_02: (process.env.UNISWAP_V2_ROUTER_02 || zeroAddress).toLowerCase() as Address,
  WETH: (process.env.WETH || zeroAddress).toLowerCase() as Address,
  WEETH: (process.env.WEETH || zeroAddress).toLowerCase() as Address,
};
