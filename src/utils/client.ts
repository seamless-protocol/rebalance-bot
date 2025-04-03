import { PublicClient, createPublicClient, http } from "viem";

import { Alchemy } from "alchemy-sdk";
import { findChainById } from "../constants/chains";

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
