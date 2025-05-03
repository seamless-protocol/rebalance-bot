export const SwapAdapterAbi = [
  {
    type: "function",
    name: "swapExactInput",
    inputs: [
      {
        name: "inputToken",
        type: "address",
        internalType: "address",
      },
      {
        name: "inputAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "minOutputAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "swapContext",
        type: "tuple",
        internalType: "struct ISwapAdapter.SwapContext",
        components: [
          {
            name: "path",
            type: "address[]",
            internalType: "address[]",
          },
          {
            name: "encodedPath",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "fees",
            type: "uint24[]",
            internalType: "uint24[]",
          },
          {
            name: "tickSpacing",
            type: "int24[]",
            internalType: "int24[]",
          },
          {
            name: "exchange",
            type: "uint8",
            internalType: "enum ISwapAdapter.Exchange",
          },
          {
            name: "exchangeAddresses",
            type: "tuple",
            internalType: "struct ISwapAdapter.ExchangeAddresses",
            components: [
              {
                name: "aerodromeRouter",
                type: "address",
                internalType: "address",
              },
              {
                name: "aerodromePoolFactory",
                type: "address",
                internalType: "address",
              },
              {
                name: "aerodromeSlipstreamRouter",
                type: "address",
                internalType: "address",
              },
              {
                name: "uniswapSwapRouter02",
                type: "address",
                internalType: "address",
              },
              {
                name: "uniswapV2Router02",
                type: "address",
                internalType: "address",
              },
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: "outputAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "swapExactOutput",
    inputs: [
      {
        name: "inputToken",
        type: "address",
        internalType: "address",
      },
      {
        name: "outputAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxInputAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "swapContext",
        type: "tuple",
        internalType: "struct ISwapAdapter.SwapContext",
        components: [
          {
            name: "path",
            type: "address[]",
            internalType: "address[]",
          },
          {
            name: "encodedPath",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "fees",
            type: "uint24[]",
            internalType: "uint24[]",
          },
          {
            name: "tickSpacing",
            type: "int24[]",
            internalType: "int24[]",
          },
          {
            name: "exchange",
            type: "uint8",
            internalType: "enum ISwapAdapter.Exchange",
          },
          {
            name: "exchangeAddresses",
            type: "tuple",
            internalType: "struct ISwapAdapter.ExchangeAddresses",
            components: [
              {
                name: "aerodromeRouter",
                type: "address",
                internalType: "address",
              },
              {
                name: "aerodromePoolFactory",
                type: "address",
                internalType: "address",
              },
              {
                name: "aerodromeSlipstreamRouter",
                type: "address",
                internalType: "address",
              },
              {
                name: "uniswapSwapRouter02",
                type: "address",
                internalType: "address",
              },
              {
                name: "uniswapV2Router02",
                type: "address",
                internalType: "address",
              },
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: "inputAmount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "error",
    name: "InvalidNumFees",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidNumTicks",
    inputs: [],
  },
] as const;
