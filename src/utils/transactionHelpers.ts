import { CHAINS, CHAIN_IDS, Chain } from "../constants/chains";

import { CONTRACT_ADDRESSES } from "../constants/contracts";

export const findChainById = (chainId: number): Chain => {
  const chain = CHAINS.find((chain) => {
    return chain.chainId === chainId;
  });

  if (!chain) {
    throw new Error(`Failed to find chain with id ${chainId}`);
  }

  return chain;
};

export const getContractAddressesByChainId = (chainId: number): Record<string, string> => {
  if (chainId === CHAIN_IDS.BASE) {
    return CONTRACT_ADDRESSES.BASE;
  }

  throw new Error(`No contract addresses found for chain id ${chainId}`);
};
