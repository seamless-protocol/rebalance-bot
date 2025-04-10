import { Address, createPublicClient, createWalletClient, http } from "viem";
import { RPC_URL, VIEM_CHAIN } from "../constants/chain";

import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

export const walletClient = createWalletClient({
  account,
  chain: VIEM_CHAIN,
  transport: http(RPC_URL),
});

export const publicClient = createPublicClient({
  chain: VIEM_CHAIN,
  transport: http(RPC_URL),
});

export const getWebSocketUrl = () => {
  return RPC_URL;
};
