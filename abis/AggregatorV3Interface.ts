const AggregatorV3InterfaceAbi = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "", type: "uint80" },
      { internalType: "int256", name: "", type: "int256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint80", name: "", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default AggregatorV3InterfaceAbi;

