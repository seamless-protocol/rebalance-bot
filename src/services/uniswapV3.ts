import { AlphaRouter, SwapOptions, SwapRoute, SwapType } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";

import { UniswapV3QuoteExactInputArgs } from "../types";
import { ethersProvider } from "../utils/transactionHelpers";

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
