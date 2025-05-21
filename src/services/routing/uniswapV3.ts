import { Address, erc20Abi } from "viem";
import { AlphaRouter, RouteWithValidQuote, SwapOptions, SwapType } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { primaryEthersProvider, publicClient } from "../../utils/transactionHelpers";

import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { UniswapV3QuoteExactInputArgs } from "../../types";

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
  try {
    return null;
    const { tokenInAddress, tokenOutAddress, amountInRaw } = args;
    const { tokenInDecimals, tokenOutDecimals } = await getTokensDecimals(tokenInAddress, tokenOutAddress);

    const tokenIn = new Token(ChainId.BASE, tokenInAddress, tokenInDecimals);
    const tokenOut = new Token(ChainId.BASE, tokenOutAddress, tokenOutDecimals);

    const router = new AlphaRouter({
      chainId: ChainId.BASE,
      // Fallback ethers provider is not supported by AlphaRouter (it calls provider.send which is not supported by ethers FallbackProvider)
      provider: primaryEthersProvider,
    });

    const amountIn = CurrencyAmount.fromRawAmount(tokenIn, amountInRaw);
    const options: SwapOptions = {
      recipient: CONTRACT_ADDRESSES.DUTCH_AUCTION_REBALANCER,
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
  } catch (error) {
    console.error("Error getting Uniswap V3 route:", error);
    return null;
  }
};
