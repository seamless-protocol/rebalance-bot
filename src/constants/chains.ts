import { base } from "viem/chains";

const BASE_RPC_URL = process.env.BASE_RPC_URL || "";

interface Chain {
  chainId: number;
  rpcUrls: string[];
  viemChain: any;
}

export const CHAINS: Chain[] = [
  {
    chainId: 8453,
    rpcUrls: [BASE_RPC_URL],
    viemChain: base,
  },
];
