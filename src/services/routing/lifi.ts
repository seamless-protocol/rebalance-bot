import { GetLIFIQuoteInput, GetLIFIQuoteOutput } from "../../types";
import { LIFI_API_KEY, LIFI_API_URL, LIFI_SLIPPAGE } from "../../constants/values";

import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import axios from "axios";

export const getLIFIQuote = async (args: GetLIFIQuoteInput): Promise<GetLIFIQuoteOutput | null> => {
  if (!LIFI_API_KEY) {
    return null;
  }

  const { fromToken, toToken, fromAmount } = args;

  try {
    const result = await axios.get(LIFI_API_URL, {
      params: {
        fromChain: CHAIN_ID,
        toChain: CHAIN_ID,
        fromToken,
        toToken,
        fromAmount,
        fromAddress: CONTRACT_ADDRESSES.MULTICALL_EXECUTOR,
        toAddress: CONTRACT_ADDRESSES.DUTCH_AUCTION_REBALANCER,
        allowBridges: "none",
        slippage: LIFI_SLIPPAGE
      },
      headers: {
        "x-lifi-api-key": LIFI_API_KEY,
      },
    });

    return {
      // We use the guaranteed minimum amount to account for any potential slippage
      amountOut: result.data.estimate.toAmountMin,
      to: result.data.transactionRequest.to,
      data: result.data.transactionRequest.data,
      value: result.data.transactionRequest.value,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};
