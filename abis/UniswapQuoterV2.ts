const UniswapQuoterV2Abi = [
  {
    name: "quoteExactOutputSingle",
    type: "function",
    stateMutability: "nonpayable",
    outputs: [
      { type: "uint256", name: "amountIn" },
      { type: "uint160", name: "sqrtPriceX96After" },
      { type: "uint32", name: "initializedTicksCrossed" },
      { type: "uint256", name: "gasEstimate" },
    ],
    inputs: [
      {
        components: [
          { type: "address", name: "tokenIn" },
          { type: "address", name: "tokenOut" },
          { type: "uint256", name: "amountOut" },
          { type: "uint24", name: "fee" },
          { type: "uint160", name: "sqrtPriceLimitX96" },
        ],
        name: "params",
        type: "tuple",
      },
    ],
  },
  {
    name: "quoteExactOutput",
    type: "function",
    stateMutability: "nonpayable",
    outputs: [
      { type: "uint256", name: "amountIn" },
      { type: "uint160[]", name: "sqrtPriceX96AfterList" },
      { type: "uint32[]", name: "initializedTicksCrossedList" },
      { type: "uint256", name: "gasEstimate" },
    ],
    inputs: [
      { type: "bytes", name: "path" },
      { type: "uint256", name: "amountOut" },
    ],
  },
];

export default UniswapQuoterV2Abi;
