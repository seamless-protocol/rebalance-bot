import { CHAINS, CHAIN_IDS } from "../constants/chains";
import { Chain, ContractAddresses } from "../types";
import { PublicClient, createPublicClient, http } from "viem";

import { Alchemy } from "alchemy-sdk";
import { CONTRACT_ADDRESSES } from "../constants/contracts";

export const getPublicClient = (chainId: number): PublicClient => {
  const chain = findChainById(chainId);

  const publicClient = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });

  return publicClient as PublicClient;
};

export const getAlchemyClient = (chainId: number): Alchemy => {
  const chain = findChainById(chainId);

  return new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: chain.alchemyNetwork,
  });
};

export const findChainById = (chainId: number): Chain => {
  const chain = CHAINS.find((chain) => {
    return chain.chainId === chainId;
  });

  if (!chain) {
    throw new Error(`Failed to find chain with id ${chainId}`);
  }

  return chain;
};

export const getContractAddressesByChainId = (chainId: number): ContractAddresses => {
  if (chainId === CHAIN_IDS.BASE) {
    return CONTRACT_ADDRESSES.BASE;
  }

  throw new Error(`No contract addresses found for chain id ${chainId}`);
};
