export const DutchAuctionRebalancerAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_owner",
        type: "address",
        internalType: "address",
      },
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
      {
        name: "_morpho",
        type: "address",
        internalType: "address",
      },
      {
        name: "_weth",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "receive",
    stateMutability: "payable",
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
    name: "morpho",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IMorpho",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "onMorphoFlashLoan",
    inputs: [
      {
        name: "flashLoanAmount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
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
    name: "sweepToken",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },{
    type: "function",
    name: "testTakeAuction",
    inputs: [
      {
        name: "leverageToken",
        type: "address",
        internalType: "address",
      },
      {
        name: "amountToTake",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "rebalanceType",
        type: "uint8",
        internalType: "enum RebalanceType",
      },
    ],
    outputs: [
      {
        name: "newCollateralRatio",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "takeAuction",
    inputs: [
      {
        name: "leverageToken",
        type: "address",
        internalType: "address",
      },
      {
        name: "amountToTake",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "rebalanceType",
        type: "uint8",
        internalType: "enum RebalanceType",
      },
      {
        name: "swapData",
        type: "tuple",
        internalType: "struct SwapData",
        components: [
          {
            name: "swapType",
            type: "uint8",
            internalType: "enum SwapType",
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
              {
                name: "additionalData",
                type: "bytes",
                internalType: "bytes",
              },
            ],
          },
          {
            name: "lifiSwap",
            type: "tuple",
            internalType: "struct LIFISwap",
            components: [
              {
                name: "to",
                type: "address",
                internalType: "address",
              },
              {
                name: "data",
                type: "bytes",
                internalType: "bytes",
              },
              {
                name: "value",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
        ],
      },
      {
        name: "stakeContext",
        type: "tuple",
        internalType: "struct StakeContext",
        components: [
          {
            name: "stakeType",
            type: "uint8",
            internalType: "enum StakeType",
          },
          {
            name: "stakeTo",
            type: "address",
            internalType: "address",
          },
          {
            name: "assetIn",
            type: "address",
            internalType: "address",
          },
          {
            name: "amountIn",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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
    type: "function",
    name: "weth",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IWETH9",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
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
      {
        name: "auctionCreated",
        type: "bool",
        indexed: true,
        internalType: "bool",
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
    name: "OwnableInvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
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
  {
    type: "error",
    name: "Unauthorized",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidLeverageTokenStateAfterRebalance",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "contract ILeverageToken",
      },
    ],
  },
] as const;
