import { createPublicClient, createWalletClient, http } from "viem";

import { CHAIN } from "../constants/chain";
import dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

export const walletClient = createWalletClient({
  account,
  chain: CHAIN.viemChain,
  transport: http(CHAIN.rpcUrl),
});

export const publicClient = createPublicClient({
  chain: CHAIN.viemChain,
  transport: http(CHAIN.rpcUrl),
});

export const getWebSocketUrl = () => {
  return CHAIN.rpcUrl;
};
