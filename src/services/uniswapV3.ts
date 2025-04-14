import { AlphaRouter, SwapOptions, SwapRoute, SwapType } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import { approveToken, ethersProvider, publicClient, walletClient } from "../utils/transactionHelpers";

import { Address } from "viem";
import { UniswapV3QuoteExactInputArgs } from "../types";
import { getUniswapSwapRouter02Contract } from "../utils/contractHelpers";

export const getRouteUniswapV3ExactInput = async (args: UniswapV3QuoteExactInputArgs): Promise<SwapRoute | null> => {
  const {
    tokenInAddress,
    tokenInDecimals,
    tokenOutAddress,
    tokenOutDecimals,
    amountInRaw,
    recipient,
    deadline,
    slippageTolerance,
  } = args;

  const tokenIn = new Token(ChainId.BASE, tokenInAddress, tokenInDecimals);
  const tokenOut = new Token(ChainId.BASE, tokenOutAddress, tokenOutDecimals);

  const router = new AlphaRouter({
    chainId: ChainId.BASE,
    provider: ethersProvider,
  });

  const amountIn = CurrencyAmount.fromRawAmount(tokenIn, amountInRaw);
  const options: SwapOptions = {
    recipient,
    slippageTolerance,
    deadline,
    type: SwapType.SWAP_ROUTER_02,
  };

  const route = await router.route(amountIn, tokenOut, TradeType.EXACT_INPUT, options);
  if (!route) {
    console.log(
      `Uniswap V3: No route found for swap ${tokenInAddress} -> ${tokenOutAddress} with amount ${amountInRaw}`
    );
    return null;
  }

  console.log(`Uniswap V3 Exact Input Quote:
    From: ${tokenInAddress}
    To: ${tokenOutAddress}
    Amount Out: ${route.quote.toExact()}
    Gas Estimate: ${route.estimatedGasUsed.toString()}
  `);

  return route;
};

export const approveSwapUniswapV3ExactInput = async (tokenAddress: Address, amountInRaw: string): Promise<string> => {
  try {
    const uniswapSwapRouter02Contract = getUniswapSwapRouter02Contract();
    const { address: routerAddress } = uniswapSwapRouter02Contract;

    const hash = await approveToken(tokenAddress, routerAddress, amountInRaw);
    return hash;
  } catch (error) {
    console.error("Uniswap V3: Error approving token for swap:", error);
    throw error;
  }
};

export const executeSwapUniswapV3ExactInput = async (route: SwapRoute): Promise<string> => {
  try {
    const { methodParameters } = route;
    if (!methodParameters) {
      throw new Error("Uniswap V3: No method parameters found in route for swap");
    }

    const uniswapSwapRouter02Contract = getUniswapSwapRouter02Contract();
    const { address: routerAddress } = uniswapSwapRouter02Contract;

    const hash = await walletClient.sendTransaction({
      data: methodParameters.calldata as `0x${string}`,
      to: routerAddress,
      value: BigInt(methodParameters.value || "0"),
    });

    console.log(`Uniswap V3: Swap transaction sent. Waiting for confirmation. Hash: ${hash}`);

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    if (receipt.status === "success") {
      console.log(`Uniswap V3: Swap executed successfully. Transaction hash: ${hash}`);
      return hash;
    }
    throw new Error(`Uniswap V3: Swap transaction failed. Hash: ${hash}`);
  } catch (error) {
    console.error("Uniswap V3: Error executing swap:", error);
    throw error;
  }
};
