import { Address, zeroAddress } from "viem";

import { ContractAddresses } from "../types";
import dotenv from "dotenv";

dotenv.config();

export const CONTRACT_ADDRESSES: ContractAddresses = {
  LEVERAGE_MANAGER: process.env.LEVERAGE_MANAGER as Address || zeroAddress,
  REBALANCER: process.env.REBALANCER as Address || zeroAddress,
};
