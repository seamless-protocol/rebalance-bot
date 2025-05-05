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
