import { Address, createPublicClient, createWalletClient, fallback, http } from "viem";
import { FALLBACK_RPC_URL, PRIMARY_RPC_URL, VIEM_CHAIN } from "../constants/chain";

import { ethers } from "ethers";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

export const walletClient = createWalletClient({
  account,
  chain: VIEM_CHAIN,
  transport: fallback([http(PRIMARY_RPC_URL), http(FALLBACK_RPC_URL)]),
});

export const publicClient = createPublicClient({
  chain: VIEM_CHAIN,
  transport: fallback([http(PRIMARY_RPC_URL), http(FALLBACK_RPC_URL)]),
});

export const ethersProvider = new ethers.providers.FallbackProvider([
  {
    provider: new ethers.providers.JsonRpcProvider(PRIMARY_RPC_URL),
    priority: 1,
  },
  {
    provider: new ethers.providers.JsonRpcProvider(FALLBACK_RPC_URL),
    priority: 2,
  },
]);
