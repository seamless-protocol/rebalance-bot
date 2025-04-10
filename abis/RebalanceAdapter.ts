import { parseAbi } from "viem";

const rebalanceAdapterAbi = parseAbi([
  "function isEligibleForRebalance(ILeverageToken token, LeverageTokenState memory state, address caller) external view returns (bool)",
  "function createAuction() external",
]);

export default rebalanceAdapterAbi;
