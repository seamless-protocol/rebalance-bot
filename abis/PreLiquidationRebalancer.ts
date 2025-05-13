export const PreLiquidationRebalancerAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_leverageManager",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_swapAdapter",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_morpho",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAmountIn",
    "inputs": [
      {
        "name": "leverageToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amountOut",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "amountIn",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "leverageManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ILeverageManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "morpho",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMorpho"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onMorphoFlashLoan",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "preLiquidationRebalance",
    "inputs": [
      {
        "name": "leverageToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amountIn",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amountOut",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "rebalanceType",
        "type": "uint8",
        "internalType": "enum RebalanceType"
      },
      {
        "name": "swapData",
        "type": "tuple",
        "internalType": "struct SwapData",
        "components": [
          {
            "name": "swapType",
            "type": "uint8",
            "internalType": "enum SwapType"
          },
          {
            "name": "swapContext",
            "type": "tuple",
            "internalType": "struct ISwapAdapter.SwapContext",
            "components": [
              {
                "name": "path",
                "type": "address[]",
                "internalType": "address[]"
              },
              {
                "name": "encodedPath",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "fees",
                "type": "uint24[]",
                "internalType": "uint24[]"
              },
              {
                "name": "tickSpacing",
                "type": "int24[]",
                "internalType": "int24[]"
              },
              {
                "name": "exchange",
                "type": "uint8",
                "internalType": "enum ISwapAdapter.Exchange"
              },
              {
                "name": "exchangeAddresses",
                "type": "tuple",
                "internalType": "struct ISwapAdapter.ExchangeAddresses",
                "components": [
                  {
                    "name": "aerodromeRouter",
                    "type": "address",
                    "internalType": "address"
                  },
                  {
                    "name": "aerodromePoolFactory",
                    "type": "address",
                    "internalType": "address"
                  },
                  {
                    "name": "aerodromeSlipstreamRouter",
                    "type": "address",
                    "internalType": "address"
                  },
                  {
                    "name": "uniswapSwapRouter02",
                    "type": "address",
                    "internalType": "address"
                  },
                  {
                    "name": "uniswapV2Router02",
                    "type": "address",
                    "internalType": "address"
                  }
                ]
              }
            ]
          },
          {
            "name": "lifiSwap",
            "type": "tuple",
            "internalType": "struct LIFISwap",
            "components": [
              {
                "name": "to",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "value",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapAdapter",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ISwapAdapter"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "error",
    "name": "LIFISwapFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;