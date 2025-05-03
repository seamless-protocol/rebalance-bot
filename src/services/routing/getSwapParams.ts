import { Address, encodeAbiParameters } from "viem";
import {
  Exchange,
  GetRebalanceSwapParamsInput,
  GetRebalanceSwapParamsOutput,
  SwapContext,
  SwapType,
} from "../../types";
import { getAmountsOutUniswapV2 } from "./uniswapV2";
import RebalanceAdapterAbi from "../../../abis/RebalanceAdapter";
import { publicClient } from "../../utils/transactionHelpers";
import { getLeverageTokenRebalanceAdapter } from "../../utils/contractHelpers";
import { EXCHANGE_ADDRESSES } from "../../constants/contracts";

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

  console.log("assetIn", assetIn);
  console.log("assetOut", assetOut);

  console.log("takeAmount", takeAmount);

  console.log("amountOutUniswapV2", amountOutUniswapV2);
  console.log("requiredAmountIn", requiredAmountIn);

  return {
    isProfitable: amountOutUniswapV2 >= requiredAmountIn,
    swapType: SwapType.EXACT_INPUT_SWAP_ADAPTER,
    swapContext: prepareUniswapV2SwapContext(assetOut, assetIn),
  };
};

const prepareUniswapV2SwapContext = (assetIn: Address, assetOut: Address): SwapContext => {
  return {
    path: [assetIn, assetOut],
    exchange: Exchange.UNISWAP_V2,
    exchangeAddresses: EXCHANGE_ADDRESSES,
    encodedPath: "0x",
    fees: [0],
    tickSpacing: [0],
  };
};
