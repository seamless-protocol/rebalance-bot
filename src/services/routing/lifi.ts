import axios from "axios";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { GetLIFIQuoteInput } from "../../types";

export const getLIFIQuote = async (args: GetLIFIQuoteInput) => {
  const { fromToken, toToken, fromAmount } = args;

  const result = await axios.get("https://li.quest/v1/quote", {
    params: {
      fromChain: 8453,
      toChain: 8453,
      fromToken,
      toToken,
      fromAmount,
      fromAddress: CONTRACT_ADDRESSES.REBALANCER,
    },
  });

  return {
    amountOut: result.data.estimate.toAmount,
    to: result.data.transactionRequest.to,
    data: result.data.transactionRequest.data,
    value: result.data.transactionRequest.value,
  };
};
