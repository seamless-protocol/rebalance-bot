const UniswapSwapRouter02Abi = [
    {
        "type": "function",
        "name": "exactInput",
        "inputs": [
            {
                "name": "params",
                "type": "tuple",
                "internalType": "struct IUniswapSwapRouter02.ExactInputParams",
                "components": [
                    {
                        "name": "path",
                        "type": "bytes",
                        "internalType": "bytes"
                    },
                    {
                        "name": "recipient",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "amountIn",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "amountOutMinimum",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "outputs": [
            {
                "name": "amountOut",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "exactInputSingle",
        "inputs": [
            {
                "name": "params",
                "type": "tuple",
                "internalType": "struct IUniswapSwapRouter02.ExactInputSingleParams",
                "components": [
                    {
                        "name": "tokenIn",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "tokenOut",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "fee",
                        "type": "uint24",
                        "internalType": "uint24"
                    },
                    {
                        "name": "recipient",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "amountIn",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "amountOutMinimum",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "sqrtPriceLimitX96",
                        "type": "uint160",
                        "internalType": "uint160"
                    }
                ]
            }
        ],
        "outputs": [
            {
                "name": "amountOut",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "exactOutput",
        "inputs": [
            {
                "name": "params",
                "type": "tuple",
                "internalType": "struct IUniswapSwapRouter02.ExactOutputParams",
                "components": [
                    {
                        "name": "path",
                        "type": "bytes",
                        "internalType": "bytes"
                    },
                    {
                        "name": "recipient",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "amountOut",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "amountInMaximum",
                        "type": "uint256",
                        "internalType": "uint256"
                    }
                ]
            }
        ],
        "outputs": [
            {
                "name": "amountIn",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "exactOutputSingle",
        "inputs": [
            {
                "name": "params",
                "type": "tuple",
                "internalType": "struct IUniswapSwapRouter02.ExactOutputSingleParams",
                "components": [
                    {
                        "name": "tokenIn",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "tokenOut",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "fee",
                        "type": "uint24",
                        "internalType": "uint24"
                    },
                    {
                        "name": "recipient",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "amountOut",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "amountInMaximum",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "sqrtPriceLimitX96",
                        "type": "uint160",
                        "internalType": "uint160"
                    }
                ]
            }
        ],
        "outputs": [
            {
                "name": "amountIn",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "payable"
    }
] as const;

export default UniswapSwapRouter02Abi;