import { RouteWithValidQuote, V3Route } from "@uniswap/smart-order-router";
import { encodeRouteToPath } from "@uniswap/v3-sdk";
import { Address, zeroAddress } from "viem";
import RebalanceAdapterAbi from "../../../abis/RebalanceAdapter";
import { EXCHANGE_ADDRESSES } from "../../constants/contracts";
import {
  Exchange,
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  LIFISwap,
  SwapContext,
  SwapType,
} from "../../types";
import { getLeverageTokenRebalanceAdapter } from "../../utils/contractHelpers";
import { publicClient } from "../../utils/transactionHelpers";
import { getLIFIQuote } from "./lifi";
import { getAmountsOutUniswapV2 } from "./uniswapV2";
import { getRouteUniswapV3ExactInput } from "./uniswapV3";

const getDummySwapType = (): SwapType => {
  return SwapType.EXACT_INPUT_SWAP_ADAPTER;
};

const getDummySwapContext = (): SwapContext => {
  return {
    path: [],
    encodedPath: "0x",
    exchange: Exchange.UNISWAP_V2,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    fees: [],
    tickSpacing: [],
  };
};

const getDummyLifiSwap = (): LIFISwap => {
  return { to: zeroAddress, value: 0n, data: "0x" };
};

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { leverageToken, assetIn, assetOut, takeAmount } = input;
  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);

  const [requiredAmountIn, lifiQuote, amountOutUniswapV2, uniswapV3Route] = await Promise.all([
    publicClient.readContract({
      address: rebalanceAdapter,
      abi: RebalanceAdapterAbi,
      functionName: "getAmountIn",
      args: [takeAmount],
    }),
    getLIFIQuote({
      fromToken: assetOut,
      toToken: assetIn,
      fromAmount: takeAmount,
    }),
    getAmountsOutUniswapV2({
      inputTokenAddress: assetOut,
      outputTokenAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }),
    getRouteUniswapV3ExactInput({
      tokenInAddress: assetOut,
      tokenOutAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }),
  ]);

  const amountOutLifi = lifiQuote.amountOut || 0n;
  const amountOutUniV2 = BigInt(amountOutUniswapV2 || "0");
  const amountOutUniV3 = BigInt((uniswapV3Route?.rawQuote || "0").toString());

  if (requiredAmountIn > amountOutLifi && requiredAmountIn > amountOutUniV2 && requiredAmountIn > amountOutUniV3) {
    return {
      isProfitable: false,
      swapType: getDummySwapType(),
      swapContext: getDummySwapContext(),
      lifiSwap: getDummyLifiSwap(),
    };
  }

  if (amountOutLifi > amountOutUniV2 && amountOutLifi > amountOutUniV3) {
    return {
      isProfitable: true,
      swapType: SwapType.LIFI_SWAP,
      lifiSwap: {
        to: lifiQuote.to,
        data: lifiQuote.data,
        value: lifiQuote.value,
      },
      swapContext: getDummySwapContext(),
    };
  }

  if (amountOutUniV2 > amountOutUniV3) {
    return {
      isProfitable: true,
      swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
      swapContext: prepareUniswapV2SwapContext(assetOut, assetIn),
      lifiSwap: getDummyLifiSwap(),
    };
  }

  return {
    isProfitable: true,
    swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
    swapContext: prepareUniswapV3SwapContext(assetOut, uniswapV3Route!),
    lifiSwap: getDummyLifiSwap(),
  };
};

const prepareUniswapV2SwapContext = (assetIn: Address, assetOut: Address): SwapContext => {
  return {
    path: [assetIn, assetOut],
    exchange: Exchange.UNISWAP_V2,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    encodedPath: "0x",
    fees: [], // Unused
    tickSpacing: [], // Unused
  };
};

const prepareUniswapV3SwapContext = (assetIn: Address, route: RouteWithValidQuote): SwapContext => {
  return {
    encodedPath: encodeRouteToPath(route.route as V3Route, false) as `0x${string}`,
    exchange: Exchange.UNISWAP_V3,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    path: [assetIn], // Only assetIn because SwapAdapter has special logic for path of length 2. Here we use the same logic no matter single swap or multi-hop.
    fees: [], // Unused
    tickSpacing: [], // Unused
  };
};
