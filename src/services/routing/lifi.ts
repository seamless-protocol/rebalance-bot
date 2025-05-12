import { GetLIFIQuoteInput, GetLIFIQuoteOutput } from "../../types";

import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { LIFI_API_URL } from "../../constants/values";
import axios from "axios";

export const getLIFIQuote = async (args: GetLIFIQuoteInput): Promise<GetLIFIQuoteOutput | null> => {
  const { fromToken, toToken, fromAmount } = args;

  try {
    const result = await axios.get(LIFI_API_URL, {
      params: {
        fromChain: 8453,
        toChain: 8453,
        fromToken,
        toToken,
        fromAmount,
        fromAddress: CONTRACT_ADDRESSES.REBALANCER,
      },
      headers: {
        "x-lifi-api-key": process.env.LIFI_API_KEY,
      },
    });

    return {
      amountOut: result.data.estimate.toAmount,
      to: result.data.transactionRequest.to,
      data: result.data.transactionRequest.data,
      value: result.data.transactionRequest.value,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};
