import { Address, zeroAddress } from "viem";

import dotenv from "dotenv";
import { ContractAddresses, ExchangeAddresses } from "../types";

dotenv.config();

export const CONTRACT_ADDRESSES: ContractAddresses = {
  LEVERAGE_MANAGER: (process.env.LEVERAGE_MANAGER as Address) || zeroAddress,
  REBALANCER: (process.env.REBALANCER as Address) || zeroAddress,
  UNISWAP_V2_ROUTER_02: (process.env.UNISWAP_V2_ROUTER_02 as Address) || zeroAddress,
};

export const EXCHANGE_ADDRESSES: ExchangeAddresses = {
  aerodromeRouter: zeroAddress,
  aerodromePoolFactory: zeroAddress,
  aerodromeSlipstreamRouter: zeroAddress,
  uniswapSwapRouter02: (process.env.UNISWAP_SWAP_ROUTER_02 as Address) || zeroAddress,
  uniswapV2Router02: (process.env.UNISWAP_V2_ROUTER_02 as Address) || zeroAddress,
};
