import { Address, erc20Abi } from "viem";
import { AlphaRouter, GasPrice, IGasPriceProvider, RouteWithValidQuote, SwapOptions, SwapType } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { primaryEthersProvider, publicClient } from "../../utils/transactionHelpers";

import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { UniswapV3QuoteExactInputArgs } from "../../types";
import { BigNumber } from "ethers";

class StaticGasPriceProvider implements IGasPriceProvider {
  constructor(private gasPriceWei: BigNumber) {}
  async getGasPrice(): Promise<GasPrice> {
    return { gasPriceWei: this.gasPriceWei }
  }
}

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
    const { tokenInAddress, tokenOutAddress, amountInRaw } = args;
    const { tokenInDecimals, tokenOutDecimals } = await getTokensDecimals(tokenInAddress, tokenOutAddress);

    const tokenIn = new Token(ChainId.BASE, tokenInAddress, tokenInDecimals);
    const tokenOut = new Token(ChainId.BASE, tokenOutAddress, tokenOutDecimals);

    const router = new AlphaRouter({
      chainId: ChainId.BASE,
      // Fallback ethers provider is not supported by AlphaRouter (it calls provider.send which is not supported by ethers FallbackProvider)
      provider: primaryEthersProvider,
      v2Supported: [],
      v4Supported: [],
      mixedSupported: [],
      // NOTE: This is required when testing on vnets.
      gasPriceProvider: new StaticGasPriceProvider(BigNumber.from('1000000000000000000')),
    });

    const amountIn = CurrencyAmount.fromRawAmount(tokenIn, amountInRaw);
    const options: SwapOptions = {
      recipient: CONTRACT_ADDRESSES.DUTCH_AUCTION_REBALANCER,
      slippageTolerance: new Percent(100),
      deadline: Number.MAX_SAFE_INTEGER,
      type: SwapType.SWAP_ROUTER_02,
    };

    const route = await router.route(amountIn, tokenOut, TradeType.EXACT_INPUT, options);

    const v3Route = route?.route.find((route) => route.protocol === "V3");

    if (!v3Route || !v3Route.quote || !v3Route.route) {
      console.log(
        `Uniswap V3: No route found for swap ${tokenInAddress} -> ${tokenOutAddress} with amount in ${amountInRaw}`
      );
      return null;
    }

    console.log(`Uniswap V3 Exact Input Quote:
    From: ${tokenInAddress}
    To: ${tokenOutAddress}
    Amount Out: ${v3Route.quote.toExact()}
  `);

    return v3Route;
  } catch (error) {
    console.error("Error getting Uniswap V3 route:", error);
    return null;
  }
};
