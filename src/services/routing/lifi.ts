import axios from "axios";
import { getAddress } from "viem";
import { LIFI_API_KEY, LIFI_API_URL, LIFI_SLIPPAGE } from "../../constants/values";
import { CHAIN_ID } from "../../constants/chain";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { GetLIFIQuoteInput, GetLIFIQuoteOutput } from "../../types";

export const getLIFIQuote = async (args: GetLIFIQuoteInput): Promise<GetLIFIQuoteOutput | null> => {
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
      // We use toAmountMin to ensure we get the minimum amount out required to repay the flash loan successfully
      amountOut: BigInt(result.data.estimate.toAmountMin),
      to: result.data.transactionRequest.to,
      data: result.data.transactionRequest.data,
      value: result.data.transactionRequest.value,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
};
