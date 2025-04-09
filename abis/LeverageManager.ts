import { parseAbi } from "viem";

const leverageManagerAbi = parseAbi([
  "event Deposit(address indexed token, address indexed sender, (uint256 collateral, uint256 debt, uint256 equity, uint256 shares, uint256 tokenFee, uint256 treasuryFee))",
  "event LeverageTokenCreated(address indexed token, address collateralAsset, address debtAsset, (address lendingAdapter, address rebalanceAdapter, uint256 depositTokenFee, uint256 withdrawTokenFee))",
  "event Withdraw(address indexed token, address indexed sender, (uint256 collateral, uint256 debt, uint256 equity, uint256 shares, uint256 tokenFee, uint256 treasuryFee))",
]);

export default leverageManagerAbi;
