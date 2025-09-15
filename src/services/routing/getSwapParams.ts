import {getEtherFiEthStakeQuote, prepareEtherFiEthStakeCalldata} from "./etherFi";
import { getLIFIQuote } from "./lifi";
import { getAmountsOutUniswapV2, prepareUniswapV2SwapCalldata } from "./uniswapV2";
import { getRouteUniswapV3ExactInput, prepareUniswapV3SwapCalldata } from "./uniswapV3";
import {
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  StakeType,
} from "../../types";

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
    return getDummySwapParams();
  }

  // If the amount out from Uniswap V2 is greater than the amount out from Uniswap V3, we use the Uniswap V2 route
  // because it provides better price.
  if (amountOutUniV2 > amountOutUniV3) {
    return {
      isProfitable: true,
      amountOut: amountOutUniV2,
      swapCalls: prepareUniswapV2SwapCalldata(assetOut, assetIn, takeAmount, requiredAmountIn),
    };
  }

  // If the amount out from Uniswap V3 is greater than or equal to the amount out from Uniswap V2, we use the Uniswap V3 route
  // because it provides better price.
  return {
    isProfitable: true,
    amountOut: amountOutUniV3,
    swapCalls: prepareUniswapV3SwapCalldata(assetOut, uniswapV3Route!, takeAmount, requiredAmountIn),
  };
};

export const getRebalanceSwapParams = async (
  input: GetRebalanceSwapParamsInput
): Promise<GetRebalanceSwapParamsOutput> => {
  const { assetIn, assetOut, takeAmount, requiredAmountIn, stakeType } = input;

  // We first check if staking / custom route can be used to swap, which typically provides the best price
  if (stakeType == StakeType.ETHERFI_ETH_WEETH) {
    const weethAmountOut = await getEtherFiEthStakeQuote(takeAmount);

    if (weethAmountOut >= requiredAmountIn) {
      return {
        isProfitable: true,
        amountOut: weethAmountOut,
        swapCalls: prepareEtherFiEthStakeCalldata(takeAmount, requiredAmountIn),
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
    return getDummySwapParams();
  }

  // Profitable, return LIFI swap calldata
  return {
    isProfitable: true,
    amountOut: amountOutLifi,
    swapCalls: [{
      target: lifiQuote.to,
      data: lifiQuote.data,
      value: lifiQuote.value,
    }]
  };
};