import { ComponentLogger } from "../../utils/logger";
import { encodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { buildSDK, QuoteRequest, QuoteResponse } from "@balmy/sdk";
import { Call } from "../../types";
import { publicClient } from "../../utils/transactionHelpers";
import { ALCHEMY_API_KEY } from "../../constants/chain";
import { LIFI_API_KEY, LIFI_API_URL } from "../../constants/values";

const sdk = buildSDK({
    quotes: {
        defaultConfig: {
            global: {
                referrer: {
                    address: zeroAddress,
                    name: zeroAddress,
                }
            },
            custom: {
                "li-fi": {
                    apiKey: LIFI_API_KEY || undefined,
                    url: LIFI_API_URL,
                }
            }
        },
        sourceList: { type: "local" }
    },
    providers: {
        source: {
            type: "custom",
            instance: publicClient
        }
    },
    prices: {
        source: {
            type: "prioritized",
            sources: [
                ...(ALCHEMY_API_KEY !== "" ? [{
                    type: 'alchemy',
                    apiKey: ALCHEMY_API_KEY,
                }] : []),
                {
                    type: 'coingecko',
                },
                {
                    type: 'defi-llama',
                }
            ]
        }
    }
});

export const getBalmyQuote = async (args: QuoteRequest, logger: ComponentLogger): Promise<QuoteResponse | null> => {
    try {
        const quote = await sdk.quoteService.getBestQuote({
            request: {
                ...args,
                filters: { excludeSources: ['swing'] },
                sourceConfig: { global: { disableValidation: true } },
            },
            config: { choose: { by: "most-swapped", using: "max sell/min buy amounts" } }
        });

        logger.debug({ quote }, 'Balmy quote');

        return quote;
    } catch (error) {
        logger.dexQuoteError({ error }, 'Error getting Balmy quote');
        return null;
    }
};

export const prepareBalmySwapCalldata = async (quote: QuoteResponse, logger: ComponentLogger): Promise<Call[] | null> => {
    try {
        const txs = sdk.quoteService.buildTxs({
            quotes: {
                [quote.source.id]: quote
            },
            sourceConfig: { global: { disableValidation: true } }
        });

        const tx = await txs[quote.source.id];

        const approveCalldata = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.source.allowanceTarget as `0x${string}`, quote.sellAmount.amount],
        });

        return [
            {
                target: quote.sellToken.address as `0x${string}`,
                data: approveCalldata,
                value: 0n,
            },
            {
                target: tx.to as `0x${string}`,
                data: tx.data as `0x${string}`,
                value: 0n,
            }
        ];
    } catch (error) {
        logger.dexQuoteError({ error }, 'Error preparing Balmy swap calldata');
        throw error;
    }
};