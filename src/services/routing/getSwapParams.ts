import { erc20Abi, encodeFunctionData } from "viem";
import {getEtherFiEthStakeQuote, prepareEtherFiEthStakeCalldata} from "./etherFi";
import { getLIFIQuote } from "./lifi";
import { getAmountsOutUniswapV2, prepareUniswapV2SwapCalldata } from "./uniswapV2";
import { getRouteUniswapV3ExactInput, prepareUniswapV3SwapCalldata } from "./uniswapV3";
import {
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  StakeType,
} from "../../types";
import { getLidoEthStakeQuote, prepareLidoEthStakeCalldata } from "./lido";
import { FLUID_DEX } from "./fluid";

export const getDummySwapParams = (): GetRebalanceSwapParamsOutput => {
  return {
    isProfitable: false,
    amountOut: 0n,
    swapCalls: [],
  };
};

export const getFallbackSwapParams = async (
  input: GetRebalanceSwapParamsInput,
  requiredAmountIn: bigint
): Promise<GetRebalanceSwapParamsOutput> => {
  const { assetIn, assetOut, takeAmount } = input;

  // Fetch routes and quotes from DEXes directly
  const [amountOutUniV2, uniswapV3Route, amountOutFluidDex] = await Promise.all([
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
    FLUID_DEX.getEstimateSwapIn(assetOut, assetIn, takeAmount),
  ]);

  const amountOutUniV3 = BigInt((uniswapV3Route?.rawQuote || "0").toString());

  // Find the best route by comparing all three options
  const routes = [
    { amountOut: amountOutUniV2, prepareCalldata: () => prepareUniswapV2SwapCalldata(assetOut, assetIn, takeAmount, requiredAmountIn) },
    { amountOut: amountOutUniV3, prepareCalldata: () => prepareUniswapV3SwapCalldata(assetOut, uniswapV3Route!, takeAmount, requiredAmountIn) },
    { amountOut: amountOutFluidDex, prepareCalldata: () => FLUID_DEX.prepareSwapCalldata(assetOut, assetIn, takeAmount) }
  ];

  // Sort by amountOut in descending order and pick the best one
  const bestRoute = routes.reduce((best, current) =>
    current.amountOut >= best.amountOut ? current : best
  );

  if (bestRoute.amountOut < requiredAmountIn) {
    return {
      isProfitable: false,
      amountOut: bestRoute.amountOut,
      swapCalls: [],
    }
  }

  return {
    isProfitable: true,
    amountOut: bestRoute.amountOut,
    swapCalls: bestRoute.prepareCalldata(),
  };
};

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { assetIn, assetOut, takeAmount, requiredAmountIn, stakeType } = input;

  // We first check if staking / custom route can be used to swap, which typically provides the best price
  if (stakeType === StakeType.ETHERFI_ETH_WEETH) {
    const weethAmountOut = await getEtherFiEthStakeQuote(takeAmount);

    if (weethAmountOut >= requiredAmountIn) {
      return {
        isProfitable: true,
        amountOut: weethAmountOut,
        swapCalls: prepareEtherFiEthStakeCalldata(takeAmount, requiredAmountIn),
      };
    }
  } else if (stakeType === StakeType.LIDO_ETH_WSTETH) {
    const wstethAmountOut = await getLidoEthStakeQuote(takeAmount);

    if (wstethAmountOut >= requiredAmountIn) {
      return {
        isProfitable: true,
        amountOut: wstethAmountOut,
        swapCalls: prepareLidoEthStakeCalldata(takeAmount),
      };
    }
  }

  const lifiQuote = await getLIFIQuote({
    fromToken: assetOut,
    toToken: assetIn,
    fromAmount: takeAmount,
  });

  // In this part fetching LIFI quote failed, so we proceed with fallback option
  // We fetch quotes directly from DEXs directly and return calldata for the option that provides the best price
  if (!lifiQuote) {
    return getFallbackSwapParams(input, requiredAmountIn);
  }

  // Fetching LIFI quote was successful, proceed with checking if it's profitable
  const amountOutLifi = lifiQuote.amountOut || 0n;

  // Not profitable, return dummy values because smart contract is not going to be called anyway
  if (requiredAmountIn > amountOutLifi) {
    return {
      isProfitable: false,
      amountOut: amountOutLifi,
      swapCalls: [],
    };
  }

  // Encode approve calldata for lifiQuote.to to spend the asset received from the rebalance (executed by the Multicall Executor contract)
  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [lifiQuote.to, takeAmount],
  });

  // Profitable, return LIFI swap calldata
  return {
    isProfitable: true,
    amountOut: amountOutLifi,
    swapCalls: [
      {
        target: assetOut,
        data: approveCalldata,
        value: 0n,
      },
      {
        target: lifiQuote.to,
        data: lifiQuote.data,
        value: 0n,
      }
    ]
  };
};