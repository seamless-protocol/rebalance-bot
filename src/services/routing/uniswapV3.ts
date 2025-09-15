import { BigNumber } from "ethers";
import { Address, encodeFunctionData, erc20Abi } from "viem";
import { AlphaRouter, GasPrice, IGasPriceProvider, RouteWithValidQuote, SwapOptions, SwapType, V3Route } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { encodeRouteToPath } from "@uniswap/v3-sdk";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call, UniswapV3QuoteExactInputArgs } from "../../types";
import { IS_USING_FORK } from "../../constants/values";
import { primaryEthersProvider, publicClient } from "../../utils/transactionHelpers";
import UniswapSwapRouter02Abi from "../../../abis/UniswapSwapRouter02";

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
      // This is required when testing on forks where gas estimation is unavailable / gas price is zero
      gasPriceProvider: IS_USING_FORK ? new StaticGasPriceProvider(BigNumber.from('1000000000000000000')) : undefined,
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

export const prepareUniswapV3SwapCalldata = (assetIn: Address, route: RouteWithValidQuote, inputAmount: bigint, outputAmountMin: bigint): Call[] => {
  const uniswapV3RouterAbi = UniswapSwapRouter02Abi;

  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.UNISWAP_SWAP_ROUTER_02, inputAmount],
  });

  const encodedPath = route?.route ? (encodeRouteToPath(route.route as V3Route, false) as `0x${string}`) : "0x";

  const swapCalldata = encodeFunctionData({
    abi: uniswapV3RouterAbi,
    functionName: 'exactInput',
    args: [{
      path: encodedPath,
      recipient: CONTRACT_ADDRESSES.DUTCH_AUCTION_REBALANCER, // Recipient of the swap is the rebalancer contract
      amountIn: inputAmount,
      amountOutMinimum: outputAmountMin,
    }],
  });

  return [
    {
      target: assetIn,
      data: approveCalldata,
      value: 0n,
    },
    {
      target: CONTRACT_ADDRESSES.UNISWAP_SWAP_ROUTER_02,
      data: swapCalldata,
      value: 0n,
    },
  ];
};

