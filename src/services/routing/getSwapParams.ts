import { RouteWithValidQuote, V3Route } from "@uniswap/smart-order-router";
import { encodeRouteToPath } from "@uniswap/v3-sdk";
import { Address } from "viem";
import RebalanceAdapterAbi from "../../../abis/RebalanceAdapter";
import { EXCHANGE_ADDRESSES } from "../../constants/contracts";
import {
  Exchange,
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  SwapContext,
  SwapType,
} from "../../types";
import { getLeverageTokenRebalanceAdapter } from "../../utils/contractHelpers";
import { publicClient } from "../../utils/transactionHelpers";
import { getAmountsOutUniswapV2 } from "./uniswapV2";
import { getRouteUniswapV3ExactInput } from "./uniswapV3";

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { leverageToken, assetIn, assetOut, takeAmount } = input;
  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);

  const requiredAmountIn = await publicClient.readContract({
    address: rebalanceAdapter,
    abi: RebalanceAdapterAbi,
    functionName: "getAmountIn",
    args: [takeAmount],
  });

  const amountOutUniswapV2 = BigInt(
    await getAmountsOutUniswapV2({
      inputTokenAddress: assetOut,
      outputTokenAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    })
  );

  const uniswapV3Route = await getRouteUniswapV3ExactInput({
    tokenInAddress: assetOut,
    tokenOutAddress: assetIn,
    amountInRaw: takeAmount.toString(),
  });

  const uniswapV3AmountOut = BigInt((uniswapV3Route?.rawQuote || 0n).toString());

  const bestOffer = uniswapV3AmountOut > amountOutUniswapV2 ? uniswapV3AmountOut : amountOutUniswapV2;

  return {
    isProfitable: amountOutUniswapV2 >= requiredAmountIn,
    swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
    swapContext:
      bestOffer === uniswapV3AmountOut
        ? prepareUniswapV3SwapContext(assetOut, uniswapV3Route!)
        : prepareUniswapV2SwapContext(assetOut, assetIn),
  };
};

const prepareUniswapV2SwapContext = (assetIn: Address, assetOut: Address): SwapContext => {
  return {
    path: [assetIn, assetOut],
    exchange: Exchange.UNISWAP_V2,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    encodedPath: "0x",
    fees: [0], // Unused
    tickSpacing: [0], // Unused
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
