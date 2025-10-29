import { Address, encodeFunctionData, erc20Abi } from "viem";
import { Call, UniswapV2GetAmountsOutArgs } from "../../types";
import { getUniswapV2Router02Contract } from "../../utils/contractHelpers";
import UniswapV2Router02Abi from "../../../abis/UniswapV2Router02";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { CHAIN_ID } from "../../constants/chain";
import { ComponentLogger } from "../../utils/logger";

export const getAmountsOutUniswapV2 = async (args: UniswapV2GetAmountsOutArgs, logger: ComponentLogger) => {
  try {
    const router = getUniswapV2Router02Contract();

    const { inputTokenAddress, outputTokenAddress, amountInRaw } = args;

    if (amountInRaw === "0") {
      return 0n;
    }

    // Convert the input string to BigInt (this is the raw base-units value)
    const amountInBaseUnits = BigInt(amountInRaw);

    // Path for a direct swap: [inputToken, outputToken]
    // For multi-hop, just insert the intermediate token(s)
    const path: Address[] = [inputTokenAddress, outputTokenAddress];

    // Call router.getAmountsOut
    const amountsOut = await router.read.getAmountsOut([amountInBaseUnits, path]);

    // For a 2-token path, amountsOut = [amountIn, amountOut]
    const outputAmountRaw = amountsOut[1];
    return outputAmountRaw;
  } catch (error) {
    logger.dexQuoteError({ error }, 'Error calling Uniswap V2 Router02 getAmountsOut');
    return 0n;
  }
};

export const prepareUniswapV2SwapCalldata = (receiver: Address, assetIn: Address, assetOut: Address, inputAmount: bigint, outputAmountMin: bigint): Call[] => {
  const uniswapV2RouterAbi = UniswapV2Router02Abi;

  // Approve the router to spend the input amount
  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES[CHAIN_ID].UNISWAP_V2_ROUTER_02, inputAmount],
  });

  const swapCalldata = encodeFunctionData({
    abi: uniswapV2RouterAbi,
    functionName: 'swapExactTokensForTokens',
    args: [
      inputAmount,
      outputAmountMin,
      [assetIn, assetOut],
      receiver,
      BigInt(Math.floor(Date.now() / 1000) + 60) // Deadline is set to 60 seconds from now
    ],
  });

  return [
    {
      target: assetIn,
      data: approveCalldata,
      value: 0n,
    },
    {
      target: CONTRACT_ADDRESSES[CHAIN_ID].UNISWAP_V2_ROUTER_02,
      data: swapCalldata,
      value: 0n,
    },
  ];
};
