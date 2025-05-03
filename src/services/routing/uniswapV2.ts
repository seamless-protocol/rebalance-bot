import { Address } from "viem";
import { UniswapV2GetAmountsOutArgs } from "../../types";
import { getUniswapV2Router02Contract } from "../../utils/contractHelpers";

export const getAmountsOutUniswapV2 = async (args: UniswapV2GetAmountsOutArgs) => {
  try {
    const router = getUniswapV2Router02Contract();

    const { inputTokenAddress, outputTokenAddress, amountInRaw } = args;

    // Convert the input string to BigInt (this is the raw base-units value)
    const amountInBaseUnits = BigInt(amountInRaw);

    // Path for a direct swap: [inputToken, outputToken]
    // For multi-hop, just insert the intermediate token(s)
    const path: Address[] = [inputTokenAddress, outputTokenAddress];

    // Call router.getAmountsOut
    const amountsOut = await router.read.getAmountsOut([amountInBaseUnits, path]);

    // For a 2-token path, amountsOut = [amountIn, amountOut]
    const outputAmountRaw = amountsOut[1];

    // console.log(`Uniswap V2 getAmountsOut quote:
    //   From: ${inputTokenAddress}
    //   To: ${outputTokenAddress}
    //   Amount Out: ${outputAmountRaw.toString()}
    // `);

    return outputAmountRaw.toString();
  } catch (error) {
    console.error("Error calling Uniswap V2 Router02 getAmountsOut:", error);
    throw error;
  }
};
