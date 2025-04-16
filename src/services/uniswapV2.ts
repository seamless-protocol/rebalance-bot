import { UniswapV2ExecuteExactInputArgs, UniswapV2GetAmountsOutArgs } from "../types";
import { approveToken, publicClient } from "../utils/transactionHelpers";
import { getUniswapSwapRouter02Contract, getUniswapV2Router02Contract } from "../utils/contractHelpers";

import { Address } from "viem";

export const getAmountsOutUniswapV2 = async (args: UniswapV2GetAmountsOutArgs) => {
  try {
    const router = getUniswapV2Router02Contract();

    const { inputTokenAddress, outputTokenAddress, amountInRaw } = args;

    // Convert the input string to BigInt (this is the raw base-units value)
    const amountInBaseUnits = BigInt(amountInRaw);

    // Path for a direct swap: [inputToken, outputToken]
    // For multi-hop, just insert the intermediate token(s)
    const path: Address[] = [inputTokenAddress, outputTokenAddress];

    // Call router.getAmountsOut
    const amountsOut = await router.read.getAmountsOut([amountInBaseUnits, path]);

    // For a 2-token path, amountsOut = [amountIn, amountOut]
    const outputAmountRaw = amountsOut[1];

    console.log(`Uniswap V2 getAmountsOut quote:
      From: ${inputTokenAddress}
      To: ${outputTokenAddress}
      Amount Out: ${outputAmountRaw.toString()}
    `);

    return outputAmountRaw.toString();
  } catch (error) {
    console.error("Error calling Uniswap V2 Router02 getAmountsOut:", error);
    throw error;
  }
};

export const approveSwapUniswapV2ExactInput = async (tokenAddress: Address, amountInRaw: string): Promise<string> => {
  try {
    const uniswapSwapRouter02Contract = getUniswapSwapRouter02Contract();
    const { address: routerAddress } = uniswapSwapRouter02Contract;

    const hash = await approveToken(tokenAddress, routerAddress, amountInRaw);
    return hash;
  } catch (error) {
    console.error("Uniswap V2: Error approving token for swap:", error);
    throw error;
  }
};

export const executeSwapUniswapV2ExactInput = async (args: UniswapV2ExecuteExactInputArgs) => {
  try {
    const { inputTokenAddress, outputTokenAddress, amountInRaw, minAmountOutRaw, receiver, deadline } = args;

    const router = getUniswapV2Router02Contract();

    const hash = await router.write.swapExactTokensForTokens([
      BigInt(amountInRaw),
      BigInt(minAmountOutRaw),
      [inputTokenAddress, outputTokenAddress],
      receiver,
      BigInt(deadline),
    ]);

    console.log(`Uniswap V2: Swap transaction sent. Waiting for confirmation. Hash: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    if (receipt.status === "success") {
      console.log(`Uniswap V2: Swap executed successfully. Transaction hash: ${hash}`);
      return hash;
    }
    throw new Error(`Uniswap V2: Swap transaction failed. Hash: ${hash}`);
  } catch (error) {
    console.error("Uniswap V2: Error executing swap:", error);
    throw error;
  }
};
