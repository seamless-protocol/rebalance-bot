import { Alchemy, Network } from "alchemy-sdk";
import { PublicClient, createPublicClient, http } from "viem";

import { base } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

export const getPublicClient = (): PublicClient | null => {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  });

  return publicClient as PublicClient;
};

export const getAlchemyClient = () => {
  return new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.BASE_MAINNET,
  });
};

export const findChainById = (chainId: number) => {
  return CHAINS.find((chain) => {
    return chain.chainId === chainId;
  });
};
