import { parseAbi } from "viem";

const leverageManagerAbi = parseAbi([
  "event LeverageTokenCreated(address indexed token, address collateralAsset, address debtAsset, (address lendingAdapter, address rebalanceAdapter, uint256 depositTokenFee, uint256 withdrawTokenFee))",
  "function getLeverageTokenState(address token) external view returns ((uint256 collateralInDebtAsset, uint256 debt, uint256 equity, uint256 collateralRatio))",
]);

export default leverageManagerAbi;
