const PendleStaticRouterAbi = [
  {
    inputs: [
      { internalType: "address", name: "market", type: "address" },
      { internalType: "address", name: "tokenIn", type: "address" },
      { internalType: "uint256", name: "amountTokenIn", type: "uint256" },
      { internalType: "uint256", name: "slippage", type: "uint256" },
    ],
    outputs: [
      { internalType: "uint256", name: "netPtOut", type: "uint256" },
      { internalType: "uint256", name: "netSyMinted", type: "uint256" },
      { internalType: "uint256", name: "netSyFee", type: "uint256" },
      { internalType: "uint256", name: "priceImpact", type: "uint256" },
      { internalType: "uint256", name: "exchangeRateAfter", type: "uint256" },
      {
        components: [
          { internalType: "uint256", name: "guessMin", type: "uint256" },
          { internalType: "uint256", name: "guessMax", type: "uint256" },
          { internalType: "uint256", name: "guessOffchain", type: "uint256" },
          { internalType: "uint256", name: "maxIteration", type: "uint256" },
          { internalType: "uint256", name: "eps", type: "uint256" },
        ],
        internalType: "struct ApproxParams",
        name: "guessPtOut",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    name: "swapExactTokenForPtStaticAndGenerateApproxParams",
    type: "function",
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getYieldTokenAndPtRate",
    inputs: [
      { internalType: "address", name: "market", type: "address" },
    ],
    outputs: [
      { internalType: "address", name: "yieldToken", type: "address" },
      { internalType: "uint256", name: "netPtOut", type: "uint256" },
      { internalType: "uint256", name: "netYieldTokenOut", type: "uint256" },
    ],
  }
] as const;

export default PendleStaticRouterAbi;
