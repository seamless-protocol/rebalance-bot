import { parseAbi } from "viem";

const rebalanceAdapterAbi = parseAbi([
  "function isEligibleForRebalance(address token, (uint256 collateralInDebtAsset, uint256 debt, uint256 equity, uint256 collateralRatio), address caller) external view returns (bool isEligible)",
]);

export default rebalanceAdapterAbi;
