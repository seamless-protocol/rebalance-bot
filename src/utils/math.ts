import { DEX_SLIPPAGE_BPS } from "../constants/values";

export const getSlippageAdjustedAmount = (amount: bigint, slippageBps: bigint) => {
  return amount * (10000n - slippageBps) / 10000n;
};

export const getDexSlippageAdjustedAmount = (amount: bigint) => {
  return getSlippageAdjustedAmount(amount, DEX_SLIPPAGE_BPS);
};