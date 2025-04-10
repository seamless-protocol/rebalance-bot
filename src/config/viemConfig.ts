import { Address, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { findChainById } from "../utils/transactionHelpers";
import { CHAIN_IDS } from "../constants/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);
const baseChain = findChainById(CHAIN_IDS.BASE);

export const walletClient = createWalletClient({
  account,
  chain: baseChain.viemChain,
  transport: http(baseChain.rpcUrl),
});

export const publicClient = createPublicClient({
  chain: baseChain.viemChain,
  transport: http(baseChain.rpcUrl),
});
