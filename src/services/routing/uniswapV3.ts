import { ChainId, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { AlphaRouter, RouteWithValidQuote, SwapOptions, SwapType } from "@uniswap/smart-order-router";
import { Address, erc20Abi, zeroAddress } from "viem";
import { UniswapV3QuoteExactInputArgs } from "../../types";
import { ethersProvider, publicClient } from "../../utils/transactionHelpers";

const getTokensDecimals = async (tokenInAddress: Address, tokenOutAddress: Address) => {
  const [tokenInDecimals, tokenOutDecimals] = await publicClient.multicall({
    contracts: [
      { address: tokenInAddress, abi: erc20Abi, functionName: "decimals" },
      { address: tokenOutAddress, abi: erc20Abi, functionName: "decimals" },
    ],
  });

  if (tokenInDecimals.status === "failure" || tokenOutDecimals.status === "failure") {
    throw new Error("Failed to get token decimals");
  }

  return { tokenInDecimals: tokenInDecimals.result, tokenOutDecimals: tokenOutDecimals.result };
};

export const getRouteUniswapV3ExactInput = async (
  args: UniswapV3QuoteExactInputArgs
): Promise<RouteWithValidQuote | null> => {
  const { tokenInAddress, tokenOutAddress, amountInRaw } = args;
  const { tokenInDecimals, tokenOutDecimals } = await getTokensDecimals(tokenInAddress, tokenOutAddress);

  const tokenIn = new Token(ChainId.BASE, tokenInAddress, tokenInDecimals);
  const tokenOut = new Token(ChainId.BASE, tokenOutAddress, tokenOutDecimals);

  const router = new AlphaRouter({
    chainId: ChainId.BASE,
    provider: ethersProvider,
  });

  const amountIn = CurrencyAmount.fromRawAmount(tokenIn, amountInRaw);
  const options: SwapOptions = {
    recipient: zeroAddress,
    slippageTolerance: new Percent(100),
    deadline: Number.MAX_SAFE_INTEGER,
    type: SwapType.SWAP_ROUTER_02,
  };

  const route = await router.route(amountIn, tokenOut, TradeType.EXACT_INPUT, options);

  const bestRoute = route?.route.reduce((best, current) => {
    return BigInt(best.quote.toExact()) > BigInt(current.quote.toExact()) ? best : current;
  });

  if (!bestRoute) {
    console.log(
      `Uniswap V3: No route found for swap ${tokenInAddress} -> ${tokenOutAddress} with amount ${amountInRaw}`
    );
    return null;
  }

  console.log(`Uniswap V3 Exact Input Quote:
    From: ${tokenInAddress}
    To: ${tokenOutAddress}
    Amount Out: ${bestRoute.quote.toExact()}
  `);

  return bestRoute;
};
