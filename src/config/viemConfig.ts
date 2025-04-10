import { Address, Chain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_IDS, CHAIN_RPC_URLS } from "../constants/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as Address);

const baseChainConfig: Chain = {
  id: CHAIN_IDS.BASE,
  rpcUrls: {
    default: {
      http: [CHAIN_RPC_URLS.BASE],
    },
  },
  name: "Base",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
};

export const walletClient = createWalletClient({
  account,
  chain: baseChainConfig,
  transport: http(),
});

export const publicClient = createPublicClient({
  chain: baseChainConfig,
  transport: http(),
});
