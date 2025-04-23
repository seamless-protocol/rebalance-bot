export const RebalancerAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_leverageManager",
        type: "address",
        internalType: "address",
      },
      {
        name: "_swapAdapter",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "_swapExactInputOnSwapAdapter",
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
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "_swapExactOutputOnSwapAdapter",
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
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getRebalanceStatus",
    inputs: [
      {
        name: "leverageToken",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "status",
        type: "uint8",
        internalType: "enum RebalanceStatus",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "leverageManager",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ILeverageManager",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "swapAdapter",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract ISwapAdapter",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tryCreateAuction",
    inputs: [
      {
        name: "leverageToken",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "TryCreateAuction",
    inputs: [
      {
        name: "leverageToken",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "status",
        type: "uint8",
        indexed: true,
        internalType: "enum RebalanceStatus",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "LIFISwapFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
  },
] as const;

export default RebalancerAbi;
