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
] as const;

export default RebalancerAbi;
