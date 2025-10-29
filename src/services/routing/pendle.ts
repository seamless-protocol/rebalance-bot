import { ComponentLogger } from "../../utils/logger";
import { CHAIN_ID } from "../../constants/chain";
import { Address, encodeFunctionData, erc20Abi, isAddressEqual, getAddress, zeroAddress } from "viem";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { Call, GetRebalanceSwapParamsOutput, GetPendleSwapQuoteInput, GetPendleSwapQuoteOutput, StakeType } from "../../types";
import { getPendleStaticRouterContract } from "../../utils/contractHelpers";
import { getDexSwapParams } from "./getSwapParams";
import PendleRouterAbi from "../../../abis/PendleRouter";
import { getTokenDecimals } from "../../utils/tokens";

const PENDLE_SLIPPAGE = 1000000000000000n; // 0.1%

// Maps from PT address to the Pendle market address to query for quotes
const PT_TO_PENDLE_MARKET = new Map<string, Address>([
  [
    // PT-RLP-4DEC2025
    getAddress("0x3A70F0C696dcB3A4aB3833cD9726397dD61AC85e"),
    "0x9942a74e6E75cEa2DB5D068c1E75C9ac687bcA06",
  ],
]);

const PENDLE_MARKET_TO_YIELD_TOKEN = new Map<Address, Address>([
  [getAddress("0x9942a74e6E75cEa2DB5D068c1E75C9ac687bcA06"), "0x4956b52ae2ff65d74ca2d61207523288e4528f96"],
]);

export const getPendleSwapQuote = async (
  args: GetPendleSwapQuoteInput,
  logger: ComponentLogger
): Promise<GetPendleSwapQuoteOutput | null> => {
  if (PT_TO_PENDLE_MARKET.has(getAddress(args.fromAsset))) {
    return getPendleSwapExactPtForTokenQuote(args, logger);
  }
  if (PT_TO_PENDLE_MARKET.has(getAddress(args.toAsset))) {
    return getPendleSwapExactTokenForPtQuote(args, logger);
  }

  return null;
};

const getPendleSwapExactPtForTokenQuote = async (
  args: GetPendleSwapQuoteInput,
  logger: ComponentLogger
): Promise<GetPendleSwapQuoteOutput | null> => {
  const { leverageToken, receiver, collateralAsset, debtAsset, fromAsset, toAsset, fromAmount } = args;

  const pt = getAddress(fromAsset);

  try {
    const pendleRouterAddress = CONTRACT_ADDRESSES[CHAIN_ID].PENDLE_ROUTER;
    if (!pendleRouterAddress) {
      return null;
    }

    const market = PT_TO_PENDLE_MARKET.get(pt);
    if (!market) {
      logger.dexQuoteError({ pt }, "No Pendle market found for PT");
      return null;
    }

    const yieldToken = PENDLE_MARKET_TO_YIELD_TOKEN.get(market);
    if (!yieldToken) {
      logger.error({ pt, market }, "No underlying yield token found for Pendle PT");
      return null;
    }

    const isYieldTokenToToken = isAddressEqual(toAsset, yieldToken);

    const staticRouter = getPendleStaticRouterContract();
    const result = await staticRouter.read.getYieldTokenAndPtRate([market]);
    const [, , yieldTokenRate] = result;

    const ptDecimals = (await getTokenDecimals([pt]))[pt];
    // We apply a default slippage to the estimate to avoid the risk of on-chain execution reverts due to state change
    // between the simulation and the actual execution.
    const yieldTokenAmountOutWithSlippage = (yieldTokenRate * fromAmount) / 10n ** BigInt(ptDecimals) * (10n ** 18n - PENDLE_SLIPPAGE) / 10n ** 18n;

    const tokenOutput = createTokenOutputSimple(yieldToken, yieldTokenAmountOutWithSlippage);
    const emptyLimit = createEmptyLimitOrderData();
    const calldata = encodeFunctionData({
      abi: PendleRouterAbi,
      functionName: "swapExactPtForToken",
      args: [
        isYieldTokenToToken ? receiver : CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
        market,
        fromAmount,
        tokenOutput,
        emptyLimit,
      ],
    });

    // Swap calldata for underlying yield token of PT -> toToken
    let underlyingSwapData: GetRebalanceSwapParamsOutput | null = null;
    if (!isYieldTokenToToken) {
      underlyingSwapData = await getDexSwapParams(
        {
          leverageToken,
          receiver,
          stakeType: StakeType.NONE,
          assetIn: toAsset,
          assetOut: yieldToken,
          takeAmount: yieldTokenAmountOutWithSlippage,
          requiredAmountIn: 0n,
          collateralAsset,
          debtAsset,
        },
        0n
      );
    }

    return {
      amountOut: underlyingSwapData?.amountOut || 0n,
      pendleSwapData: {
        amountIn: fromAmount,
        assetIn: pt,
        data: calldata,
        to: pendleRouterAddress,
        value: 0n,
      },
      underlyingSwapData,
      to: pendleRouterAddress,
      value: 0n,
      prepareCalldata: (quote: GetPendleSwapQuoteOutput) => preparePendleSwapExactPtForTokenCalldata(quote),
    };
  } catch (error) {
    logger.dexQuoteError({ error }, "Error getting Pendle swap quote");
    return null;
  }
};

const getPendleSwapExactTokenForPtQuote = async (
  args: GetPendleSwapQuoteInput,
  logger: ComponentLogger
): Promise<GetPendleSwapQuoteOutput | null> => {
  const { leverageToken, receiver, collateralAsset, debtAsset, fromAsset, toAsset, fromAmount } = args;

  const pt = getAddress(toAsset);

  try {
    const pendleRouterAddress = CONTRACT_ADDRESSES[CHAIN_ID].PENDLE_ROUTER;
    if (!pendleRouterAddress) {
      logger.dexQuoteError({ pendleRouterAddress }, "Pendle router address is not set");
      return null;
    }

    const market = PT_TO_PENDLE_MARKET.get(pt);
    if (!market) {
      logger.dexQuoteError({ pt }, "No Pendle market found for PT");
      return null;
    }

    const yieldToken = PENDLE_MARKET_TO_YIELD_TOKEN.get(getAddress(market));
    if (!yieldToken) {
      logger.error({ pt, market }, "No underlying yield token found for Pendle PT");
      return null;
    }

    const isFromTokenYieldToken = isAddressEqual(getAddress(fromAsset), getAddress(yieldToken));

    // Swap calldata for from token -> underlying token of PT
    let underlyingSwapData: GetRebalanceSwapParamsOutput | null = null;
    let underlyingAmountInForPt = fromAmount;
    if (!isFromTokenYieldToken) {
      underlyingSwapData = await getDexSwapParams(
        {
          leverageToken,
          // Set to the multicall executor because after the swap, the underlying token of the PT is used to mint PTs
          receiver: CONTRACT_ADDRESSES[CHAIN_ID].MULTICALL_EXECUTOR,
          stakeType: StakeType.NONE,
          assetIn: yieldToken,
          assetOut: fromAsset,
          takeAmount: fromAmount,
          requiredAmountIn: 0n,
          collateralAsset,
          debtAsset,
        },
        0n
      );

      underlyingAmountInForPt = underlyingSwapData.amountOut;
    }

    const staticRouter = getPendleStaticRouterContract();
    const result = await staticRouter.read.swapExactTokenForPtStaticAndGenerateApproxParams([
      market,
      yieldToken,
      underlyingAmountInForPt,
      PENDLE_SLIPPAGE,
    ]);
    const guessPtOut = result[5];

    const approxParams = guessPtOut;
    const tokenInput = createTokenInputSimple(yieldToken, underlyingAmountInForPt);
    const emptyLimit = createEmptyLimitOrderData();
    const calldata = encodeFunctionData({
      abi: PendleRouterAbi,
      functionName: "swapExactTokenForPt",
      args: [
        receiver,
        market,
        0n,
        approxParams,
        tokenInput,
        emptyLimit,
      ],
    });

    return {
      amountOut: guessPtOut.guessOffchain,
      pendleSwapData: {
        amountIn: underlyingAmountInForPt,
        assetIn: yieldToken,
        data: calldata,
        to: pendleRouterAddress,
        value: 0n,
      },
      underlyingSwapData,
      to: pendleRouterAddress,
      value: 0n,
      prepareCalldata: (quote: GetPendleSwapQuoteOutput) => preparePendleSwapExactTokenForPtCalldata(quote),
    };
  } catch (error) {
    logger.dexQuoteError({ error }, "Error getting Pendle swap quote");
    return null;
  }
};

export const preparePendleSwapExactPtForTokenCalldata = (pendleQuote: {
  pendleSwapData: { amountIn: bigint; assetIn: Address; data: `0x${string}`; to: Address; value: bigint };
  underlyingSwapData: GetRebalanceSwapParamsOutput | null;
}): Call[] => {
  const pendleRouterApproveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [pendleQuote.pendleSwapData.to, pendleQuote.pendleSwapData.amountIn],
  });

  return [
    {
      target: pendleQuote.pendleSwapData.assetIn,
      data: pendleRouterApproveCalldata,
      value: 0n,
    },
    {
      target: pendleQuote.pendleSwapData.to,
      data: pendleQuote.pendleSwapData.data,
      value: 0n,
    },
    ...(pendleQuote.underlyingSwapData?.swapCalls || []),
  ];
};

export const preparePendleSwapExactTokenForPtCalldata = (pendleQuote: {
  pendleSwapData: { amountIn: bigint; assetIn: Address; data: `0x${string}`; to: Address; value: bigint };
  underlyingSwapData: GetRebalanceSwapParamsOutput | null;
}): Call[] => {
  const pendleRouterApproveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [pendleQuote.pendleSwapData.to, pendleQuote.pendleSwapData.amountIn],
  });

  const calldata = [
    ...(pendleQuote.underlyingSwapData?.swapCalls || []),
    {
      target: pendleQuote.pendleSwapData.assetIn,
      data: pendleRouterApproveCalldata,
      value: 0n,
    },
    {
      target: pendleQuote.pendleSwapData.to,
      data: pendleQuote.pendleSwapData.data,
      value: 0n,
    },
  ];

  return calldata;
};

const createTokenInputSimple = (tokenIn: Address, netTokenIn: bigint) => {
  return {
    tokenIn,
    netTokenIn,
    tokenMintSy: tokenIn,
    pendleSwap: zeroAddress,
    swapData: {
      swapType: 0,
      extRouter: zeroAddress,
      extCalldata: "" as `0x${string}`,
      needScale: false,
    },
  };
};

const createTokenOutputSimple = (tokenOut: Address, minTokenOut: bigint) => {
  return {
    tokenOut,
    minTokenOut,
    tokenRedeemSy: tokenOut,
    pendleSwap: zeroAddress,
    swapData: {
      swapType: 0,
      extRouter: zeroAddress,
      extCalldata: "" as `0x${string}`,
      needScale: false,
    },
  };
};

const createEmptyLimitOrderData = () => {
  return {
    limitRouter: zeroAddress,
    epsSkipMarket: 0n,
    normalFills: [],
    flashFills: [],
    optData: "" as `0x${string}`,
  };
};
