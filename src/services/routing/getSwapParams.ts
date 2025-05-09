import { Address, zeroAddress } from "viem";
import {
  Exchange,
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  LIFISwap,
  SwapContext,
  SwapType,
} from "../../types";
import { RouteWithValidQuote, V3Route } from "@uniswap/smart-order-router";

import { EXCHANGE_ADDRESSES } from "../../constants/contracts";
import RebalanceAdapterAbi from "../../../abis/RebalanceAdapter";
import { encodeRouteToPath } from "@uniswap/v3-sdk";
import { getAmountsOutUniswapV2 } from "./uniswapV2";
import { getLIFIQuote } from "./lifi";
import { getLeverageTokenRebalanceAdapter } from "../../utils/contractHelpers";
import { getRouteUniswapV3ExactInput } from "./uniswapV3";
import { publicClient } from "../../utils/transactionHelpers";

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

export const getFallbackSwapParams = async (
  input: GetRebalanceSwapParamsInput,
  requiredAmountIn: bigint
): Promise<GetRebalanceSwapParamsOutput> => {
  const { assetIn, assetOut, takeAmount } = input;

  // Fetch the routes and quotes from Uniswap V2 and V3
  const [amountOutUniswapV2, uniswapV3Route] = await Promise.all([
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

  // Format them to bigints
  const amountOutUniV2 = BigInt(amountOutUniswapV2 || "0");
  const amountOutUniV3 = BigInt((uniswapV3Route?.rawQuote || "0").toString());

  // This is the case where the required input amount on auction is bigger than swap amount from both routes
  // In this case swap will result in insufficient amount out and we will not be able to repay flash loan
  // In this case we return dummy values and isProfitable will be false
  if (requiredAmountIn > amountOutUniV2 && requiredAmountIn > amountOutUniV3) {
    return {
      isProfitable: false,
      swapType: getDummySwapType(),
      swapContext: getDummySwapContext(),
      lifiSwap: getDummyLifiSwap(),
    };
  }

  // If the amount out from Uniswap V2 is greater than the amount out from Uniswap V3, we use the Uniswap V2 route
  // because it provides better price. lifiSwap field is not going to be used in smart contract so we put dummy values
  if (amountOutUniV2 > amountOutUniV3) {
    return {
      isProfitable: true,
      swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
      swapContext: prepareUniswapV2SwapContext(assetOut, assetIn),
      lifiSwap: getDummyLifiSwap(),
    };
  }

  // If the amount out from Uniswap V3 is greater than the amount out from Uniswap V2, we use the Uniswap V3 route
  // because it provides better price. lifiSwap field is not going to be used in smart contract so we put dummy values
  return {
    isProfitable: true,
    swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
    swapContext: prepareUniswapV3SwapContext(assetOut, uniswapV3Route!),
    lifiSwap: getDummyLifiSwap(),
  };
};

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { leverageToken, assetIn, assetOut, takeAmount } = input;
  const rebalanceAdapter = getLeverageTokenRebalanceAdapter(leverageToken);

  const [requiredAmountIn, lifiQuote] = await Promise.all([
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
  ]);

  // In this part fetching LIFI quote failed, so we proceed with fallback option
  // We fetch quotes directly from Uniswap V2 and V3 and return the best quote with smart contract call parameters
  if (!lifiQuote) {
    return await getFallbackSwapParams(input, requiredAmountIn);
  }

  // Fetching LIFI quote was successful, proceed with checking if it's profitable
  const amountOutLifi = lifiQuote.amountOut || 0n;

  // Not profitable, return dummy values because smart contract is not going to be called anyway
  if (requiredAmountIn > amountOutLifi) {
    return {
      isProfitable: false,
      swapType: getDummySwapType(),
      swapContext: getDummySwapContext(),
      lifiSwap: getDummyLifiSwap(),
    };
  }

  // Profitable, return LIFI swap calldata
  // Swap context is used only for calls to swap adapter
  // In case of LIFI swap we are not using swap adapter, so we put dummy values because smart contract is not going to use them at all
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
    encodedPath: route?.route ? (encodeRouteToPath(route.route as V3Route, false) as `0x${string}`) : "0x",
    exchange: Exchange.UNISWAP_V3,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    path: [assetIn], // Only assetIn because SwapAdapter has special logic for path of length 2. Here we use the same logic no matter single swap or multi-hop.
    fees: [], // Unused
    tickSpacing: [], // Unused
  };
};
