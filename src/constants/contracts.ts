import { CHAIN_IDS } from "./chains";

export const CONTRACT_ADDRESSES: Record<string, Record<string, string>> = {
  BASE: {
    LEVERAGE_MANAGER: "0x0000000000000000000000000000000000000000",
  },
};

export const getContractAddressesByChainId = (chainId: number): Record<string, string> => {
  if (chainId === CHAIN_IDS.BASE) {
    return CONTRACT_ADDRESSES.BASE;
  }

  throw new Error(`No contract addresses found for chain id ${chainId}`);
};
