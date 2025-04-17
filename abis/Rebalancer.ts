export const RebalancerAbi = [
  {
    type: "function",
    name: "getRebalanceStatus",
    inputs: [
      {
        name: "leverageManager",
        type: "address",
        internalType: "address",
      },
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
    name: "onMorphoFlashLoan",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
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
    name: "takeAuctionRebalanceDown",
    inputs: [
      {
        name: "rebalanceAdapter",
        type: "address",
        internalType: "address",
      },
      {
        name: "collateral",
        type: "address",
        internalType: "address",
      },
      {
        name: "debt",
        type: "address",
        internalType: "address",
      },
      {
        name: "amountToTake",
        type: "uint256",
        internalType: "uint256",
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
        name: "leverageManager",
        type: "address",
        internalType: "address",
      },
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
] as const;

export default RebalancerAbi;
