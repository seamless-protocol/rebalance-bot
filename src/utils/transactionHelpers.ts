import { Address, createPublicClient, createWalletClient, erc20Abi, getContract, http } from "viem";
import { RPC_URL, VIEM_CHAIN } from "../constants/chain";

import { ethers } from "ethers";
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

export const ethersProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

export const approveToken = async (tokenAddress: Address, spenderAddress: Address, amountInRaw: string) => {
  try {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: erc20Abi,
      client: walletClient,
    });

    const hash = await tokenContract.write.approve([spenderAddress, BigInt(amountInRaw)], {});

    console.log(
      `Approval transaction sent for token ${tokenAddress} to spender ${spenderAddress}. Waiting for confirmation. Hash: ${hash}`
    );

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    if (receipt.status === "success") {
      console.log(
        `Approval executed successfully for token ${tokenAddress} to spender ${spenderAddress}. Transaction hash: ${hash}`
      );
      return hash;
    }

    throw new Error(
      `Approval transaction failed for token ${tokenAddress} to spender ${spenderAddress}. Transaction hash: ${hash}`
    );
  } catch (error) {
    console.error("Error approving token:", error);
    throw error;
  }
};
