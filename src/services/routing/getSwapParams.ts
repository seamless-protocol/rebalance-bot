import {getEtherFiEthStakeQuote, prepareEtherFiEthStakeCalldata} from "./etherFi";
import { getAmountsOutUniswapV2, prepareUniswapV2SwapCalldata } from "./uniswapV2";
import { getRouteUniswapV3ExactInput, prepareUniswapV3SwapCalldata } from "./uniswapV3";
import {
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  StakeType,
} from "../../types";
import { getLidoEthStakeQuote, prepareLidoEthStakeCalldata } from "./lido";
import { FLUID_DEX } from "./fluid";
import { createComponentLogger } from "../../utils/logger";
import { getBalmyQuote, prepareBalmySwapCalldata } from "./balmy";
import { CHAIN_ID } from "../../constants/chain";
import { getAddress } from "viem";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";

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
  requiredAmountIn: bigint
): Promise<GetRebalanceSwapParamsOutput> => {
  const { leverageToken, assetIn, assetOut, takeAmount } = input;

  // Fetch routes and quotes from DEXes directly
  const [balmyQuote, amountOutUniV2, uniswapV3Route, fluidDexRoute] = await Promise.all([
    getBalmyQuote({
      chainId: CHAIN_ID,
      sellToken: assetOut as `0x${string}`,
      buyToken: assetIn as `0x${string}`,
      order: {
        type: "sell",
        sellAmount: takeAmount,
      },
      slippagePercentage: 0.01,
      takerAddress: getAddress(CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR),
      recipient: getAddress(CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER),
    }, logger),
    getAmountsOutUniswapV2({
      inputTokenAddress: assetOut,
      outputTokenAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }, logger),
    getRouteUniswapV3ExactInput({
      tokenInAddress: assetOut,
      tokenOutAddress: assetIn,
      amountInRaw: takeAmount.toString(),
    }, logger),
    FLUID_DEX.getEstimateSwapIn(assetOut, assetIn, takeAmount, logger),
  ]);

  if (!balmyQuote && !amountOutUniV2 && !uniswapV3Route && !fluidDexRoute) {
    throw new Error('No quotes found');
  }

  // Find the best route by comparing all three options
  const routes = [
    { amountOut: balmyQuote?.buyAmount.amount || 0n, prepareCalldata: async () => await prepareBalmySwapCalldata(balmyQuote!, logger) },
    { amountOut: amountOutUniV2, prepareCalldata: async () => prepareUniswapV2SwapCalldata(assetOut, assetIn, takeAmount, requiredAmountIn) },
    { amountOut: BigInt((uniswapV3Route?.rawQuote || "0").toString()), prepareCalldata: async () => prepareUniswapV3SwapCalldata(assetOut, uniswapV3Route!, takeAmount, requiredAmountIn) },
    { amountOut: fluidDexRoute.amountOut, prepareCalldata: async () => FLUID_DEX.prepareSwapCalldata(fluidDexRoute.pool, assetOut, takeAmount) }
  ];

  logger.debug({
    leverageToken,
    assetIn,
    assetOut,
    fromAmount: takeAmount,
    balmy: routes[0].amountOut,
    uniswapV2: routes[1].amountOut,
    uniswapV3: routes[2].amountOut,
    fluid: routes[3].amountOut,
   }, 'DEX swap quotes');

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
    swapCalls: await bestRoute.prepareCalldata() || [],
  };
};