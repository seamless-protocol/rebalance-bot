export const DutchAuctionRebalancerAbi = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_owner",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_leverageManager",
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
        "name": "getRebalanceStatus",
        "inputs": [
            {
                "name": "leverageToken",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "status",
                "type": "uint8",
                "internalType": "enum RebalanceStatus"
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
                "name": "flashLoanAmount",
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
        "name": "owner",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "previewTakeAuction",
        "inputs": [
            {
                "name": "leverageToken",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "amountToTake",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "rebalanceType",
                "type": "uint8",
                "internalType": "enum RebalanceType"
            }
        ],
        "outputs": [
            {
                "name": "isAuctionValid",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "newCollateralRatio",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "sweepToken",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "to",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "takeAuction",
        "inputs": [
            {
                "name": "rebalanceAdapter",
                "type": "address",
                "internalType": "contract IRebalanceAdapter"
            },
            {
                "name": "rebalanceAssetIn",
                "type": "address",
                "internalType": "contract IERC20"
            },
            {
                "name": "rebalanceAssetOut",
                "type": "address",
                "internalType": "contract IERC20"
            },
            {
                "name": "amountToTake",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "multicallExecutor",
                "type": "address",
                "internalType": "contract IMulticallExecutor"
            },
            {
                "name": "swapCalls",
                "type": "tuple[]",
                "internalType": "struct IMulticallExecutor.Call[]",
                "components": [
                    {
                        "name": "target",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "value",
                        "type": "uint256",
                        "internalType": "uint256"
                    },
                    {
                        "name": "data",
                        "type": "bytes",
                        "internalType": "bytes"
                    }
                ]
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [
            {
                "name": "newOwner",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "createAuction",
        "inputs": [
            {
                "name": "leverageToken",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {
                "name": "previousOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "newOwner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "AuctionCreated",
        "inputs": [
            {
                "name": "leverageToken",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "status",
                "type": "uint8",
                "indexed": true,
                "internalType": "enum RebalanceStatus"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AuctionAlreadyExists",
        "inputs": []
    },
    {
        "type": "error",
        "name": "IneligibleForRebalance",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [
            {
                "name": "owner",
                "type": "address",
                "internalType": "address"
            }
        ]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            }
        ]
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
