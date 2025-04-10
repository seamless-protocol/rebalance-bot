import { Address, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../constants/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

export const walletClient = createWalletClient({
  account,
  chain: CHAINS.BASE.viemChain,
  transport: http(CHAINS.BASE.rpcUrl),
});

export const publicClient = createPublicClient({
  chain: CHAINS.BASE.viemChain,
  transport: http(CHAINS.BASE.rpcUrl),
});

export const getWebSocketUrl = () => {
  return CHAINS.BASE.rpcUrl;
};
