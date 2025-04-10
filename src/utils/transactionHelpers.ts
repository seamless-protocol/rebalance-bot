import { Address, createPublicClient, createWalletClient, http } from "viem";

import { CHAIN } from "../constants/chain";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

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
