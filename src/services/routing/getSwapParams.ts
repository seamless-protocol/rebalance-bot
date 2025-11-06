import { getAddress } from "viem";
import {getEtherFiEthStakeQuote, prepareEtherFiEthStakeCalldata} from "./etherFi";
import { getAmountsOutUniswapV2, prepareUniswapV2SwapCalldata } from "./uniswapV2";
import { getRouteUniswapV3ExactInput, prepareUniswapV3SwapCalldata } from "./uniswapV3";
import {
  GetDexSwapParamsOutput,
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  StakeType,
} from "../../types";
import { getLidoEthStakeQuote, prepareLidoEthStakeCalldata } from "./lido";
import { BALMY_SLIPPAGE_PERCENTAGE } from "../../constants/values";
import { FLUID_DEX } from "./fluid";
import { createComponentLogger } from "../../utils/logger";
import { getPendleSwapQuote } from "./pendle";
import { getBalmyQuote, prepareBalmySwapCalldata } from "./balmy";
import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";

export const NoQuotesError = new Error('No quotes found');

const logger = createComponentLogger('getRebalanceSwapParams');

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { takeAmount, requiredAmountIn, stakeType } = input;

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

  return getDexSwapParams(input, requiredAmountIn);
};

export const getDexSwapParams = async (
  input: GetRebalanceSwapParamsInput,
  requiredAmountIn: bigint,
): Promise<GetDexSwapParamsOutput> => {
  const { leverageToken, receiver, assetIn, assetOut, takeAmount, collateralAsset, debtAsset } = input;

  const [balmyQuote, uniswapV2Quote, uniswapV3Route, fluidDexRoute, pendleQuote] = await Promise.all([
    getBalmyQuote({
      chainId: CHAIN_ID,
      sellToken: assetOut as `0x${string}`,
      buyToken: assetIn as `0x${string}`,
      order: {
        type: "sell",
        sellAmount: takeAmount,
      },
      slippagePercentage: BALMY_SLIPPAGE_PERCENTAGE,
      takerAddress: getAddress(CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR),
      recipient: getAddress(receiver),
    }, logger),
    getAmountsOutUniswapV2({
      inputTokenAddress: assetOut,
      outputTokenAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }, logger),
    getRouteUniswapV3ExactInput({
      receiver,
      tokenInAddress: assetOut,
      tokenOutAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }, logger),
    FLUID_DEX.getEstimateSwapIn(assetOut, assetIn, takeAmount, logger),
    getPendleSwapQuote({
      leverageToken,
      receiver,
      collateralAsset,
      debtAsset,
      fromAsset: assetOut,
      toAsset: assetIn,
      fromAmount: takeAmount,
    }, logger),
  ]);

  if (!balmyQuote && !uniswapV2Quote && !uniswapV3Route && !fluidDexRoute && !pendleQuote) {
    throw NoQuotesError;
  }

  // Find the best route by comparing all three options
  const routes = [
    { amountOut: balmyQuote?.buyAmount.amount || 0n, minAmountOut: balmyQuote?.minBuyAmount.amount || 0n, prepareCalldata: async () => prepareBalmySwapCalldata(balmyQuote!, logger) },
    { amountOut: uniswapV2Quote?.amountOut || 0n, minAmountOut: uniswapV2Quote?.minAmountOut || 0n, prepareCalldata: async () => prepareUniswapV2SwapCalldata(receiver, assetOut, assetIn, takeAmount, requiredAmountIn) },
    { amountOut: BigInt((uniswapV3Route?.route.rawQuote || "0").toString()), minAmountOut: uniswapV3Route?.minAmountOut || 0n, prepareCalldata: async () => prepareUniswapV3SwapCalldata(receiver, assetOut, uniswapV3Route!.route, takeAmount, requiredAmountIn) },
    { amountOut: fluidDexRoute?.amountOut || 0n, minAmountOut: fluidDexRoute?.minAmountOut || 0n, prepareCalldata: async () => FLUID_DEX.prepareSwapCalldata(receiver, fluidDexRoute!.pool, assetOut, takeAmount) },
    { amountOut: pendleQuote?.amountOut || 0n, minAmountOut: pendleQuote?.minAmountOut || 0n, prepareCalldata: async () => pendleQuote ? pendleQuote.prepareCalldata(pendleQuote) : [] },
  ];

  logger.debug({
    leverageToken,
    assetIn,
    assetOut,
    fromAmount: takeAmount,
    requiredAmountOut: requiredAmountIn,
    balmy: routes[0].amountOut,
    uniswapV2: routes[1].amountOut,
    uniswapV3: routes[2].amountOut,
    fluid: routes[3].amountOut,
    pendle: routes[4].amountOut,
   }, 'DEX swap quotes');

  // Sort by amountOut in descending order and pick the best one
  const bestRoute = routes.reduce((best, current) =>
    current.amountOut >= best.amountOut ? current : best
  );

  if (bestRoute.amountOut < requiredAmountIn) {
    return {
      isProfitable: false,
      amountOut: bestRoute.amountOut,
      minAmountOut: bestRoute.minAmountOut,
      swapCalls: [],
    }
  }

  return {
    isProfitable: true,
    amountOut: bestRoute.amountOut,
    minAmountOut: bestRoute.minAmountOut,
    swapCalls: await bestRoute.prepareCalldata() || [],
  };
};