import { parseAbi } from "viem";

const leverageManagerAbi = parseAbi([
  "event LeverageTokenCreated(address indexed token, address collateralAsset, address debtAsset, (address lendingAdapter, address rebalanceAdapter, uint256 depositTokenFee, uint256 withdrawTokenFee))",
]);

export default leverageManagerAbi;
