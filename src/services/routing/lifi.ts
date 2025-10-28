import axios from "axios";
import { Address, encodeFunctionData, erc20Abi, getAddress } from "viem";
import { LIFI_API_KEY, LIFI_API_URL, LIFI_SLIPPAGE } from "../../constants/values";
import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call, GetLIFIQuoteInput, GetLIFIQuoteOutput } from "../../types";
import { ComponentLogger } from "../../utils/logger";

export const getLIFIQuote = async (args: GetLIFIQuoteInput, logger: ComponentLogger): Promise<GetLIFIQuoteOutput | null> => {
  if (!LIFI_API_KEY) {
    return null;
  }

  const { fromToken, toToken, fromAmount } = args;

  try {
    // Addresses must be checksummed addresses
    const result = await axios.get(LIFI_API_URL, {
      params: {
        fromChain: CHAIN_ID,
        toChain: CHAIN_ID,
        fromToken: getAddress(fromToken),
        toToken: getAddress(toToken),
        fromAmount,
        fromAddress: getAddress(CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR),
        toAddress: getAddress(CONTRACT_ADDRESSES[CHAIN_ID].DUTCH_AUCTION_REBALANCER),
        allowBridges: "none",
        slippage: LIFI_SLIPPAGE
      },
      headers: {
        "x-lifi-api-key": LIFI_API_KEY,
      },
    });

    return {
      amountOut: BigInt(result.data.estimate.toAmount),
      to: result.data.transactionRequest.to,
      data: result.data.transactionRequest.data,
      value: result.data.transactionRequest.value,
    };
  } catch (error) {
    logger.dexQuoteError({ error }, 'Error getting LIFI quote');
    return null;
  }
};

export const prepareLIFISwapCalldata = (lifiQuote: GetLIFIQuoteOutput, assetIn: Address, inputAmount: bigint): Call[] => {
  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [lifiQuote.to, inputAmount],
  });

  return [
    {
      target: assetIn,
      data: approveCalldata,
      value: 0n,
    },
    {
      target: lifiQuote.to,
      data: lifiQuote.data,
      value: 0n,
    }
  ];
};