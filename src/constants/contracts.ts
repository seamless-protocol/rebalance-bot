import { zeroAddress } from "viem";
import { ContractAddresses } from "../types";

export const CONTRACT_ADDRESSES: Record<string, ContractAddresses> = {
  BASE: {
    LEVERAGE_MANAGER: zeroAddress,
    REBALANCER: zeroAddress,
  },
};
