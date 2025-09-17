// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {LeverageTokenState, RebalanceType, RebalanceAction, ActionType} from "./DataTypes.sol";
import {ILeverageManager} from "./interfaces/ILeverageManager.sol";
import {IMorpho} from "./interfaces/IMorpho.sol";
import {IMulticallExecutor} from "./interfaces/IMulticallExecutor.sol";
import {IPreLiquidationRebalancer} from "./interfaces/IPreLiquidationRebalancer.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";

contract PreLiquidationRebalancer is IPreLiquidationRebalancer, Ownable {
    uint256 public constant REWARD_BASE = 100_00;

    ILeverageManager public immutable leverageManager;
    IMorpho public immutable morpho;

    modifier onlyMorpho() {
        if (msg.sender != address(morpho)) revert Unauthorized();
        _;
    }

    constructor(address _owner, address _leverageManager, address _morpho) Ownable(_owner) {
        leverageManager = ILeverageManager(_leverageManager);
        morpho = IMorpho(_morpho);
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function sweepToken(address token, address to) external onlyOwner {
        SafeERC20.safeTransfer(IERC20(token), to, IERC20(token).balanceOf(address(this)));
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function isEligibleForPreLiquidationRebalance(address leverageToken) external view returns (bool) {
        LeverageTokenState memory state = leverageManager.getLeverageTokenState(leverageToken);

        address rebalanceAdapter = leverageManager.getLeverageTokenRebalanceAdapter(leverageToken);
        uint256 collateralRatioThreshold = IRebalanceAdapter(rebalanceAdapter).getCollateralRatioThreshold();

        return state.collateralRatio < collateralRatioThreshold;
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function getAmountIn(address leverageToken, uint256 amountOut) external view returns (uint256 amountIn) {
        // Fetch lending adapter and rebalance adapter for given leverage token
        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);
        address rebalanceAdapter = leverageManager.getLeverageTokenRebalanceAdapter(leverageToken);

        // Fetch liquidation penalty and pre liquidation reward
        uint256 liquidationPenalty = ILendingAdapter(lendingAdapter).getLiquidationPenalty();
        uint256 relPreLiquidationReward = IRebalanceAdapter(rebalanceAdapter).getRebalanceReward();
        uint256 preLiquidationReward = Math.mulDiv(liquidationPenalty, relPreLiquidationReward, REWARD_BASE);

        // If LT is in pre liquidation state we are always withdrawing collateral and repaying debt
        // When LT is in pre-liquidation state, we can take reward which means that we don't need to cover entire collateral

        uint256 amountInWithoutReward = ILendingAdapter(lendingAdapter).convertCollateralToDebtAsset(amountOut);
        return Math.mulDiv(amountInWithoutReward, 1e18, 1e18 + preLiquidationReward, Math.Rounding.Ceil);
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function preLiquidationRebalance(
        address leverageToken,
        uint256 amountIn,
        uint256 amountOut,
        RebalanceType rebalanceType,
        IMulticallExecutor multicallExecutor,
        IMulticallExecutor.Call[] calldata swapCalls
    ) external onlyOwner {
        // Fetch collateral and debt asset for leverage token so we can determine what should be input asset and what should be output asset
        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);
        address collateralAsset = ILendingAdapter(lendingAdapter).getCollateralAsset();
        address debtAsset = ILendingAdapter(lendingAdapter).getDebtAsset();

        address assetIn;
        address assetOut;

        // If rebalance type is rebalance down this means that we need to add collateral and borrow debt
        // Otherwise we need to repay debt and remove collateral
        if (rebalanceType == RebalanceType.REBALANCE_DOWN) {
            assetIn = collateralAsset;
            assetOut = debtAsset;
        } else {
            assetIn = debtAsset;
            assetOut = collateralAsset;
        }

        // Flashloan from Morpho and putting all required parameters to execute rebalance and repay
        morpho.flashLoan(
            assetIn,
            amountIn,
            abi.encode(leverageToken, assetIn, assetOut, amountOut, rebalanceType, multicallExecutor, swapCalls)
        );
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function onMorphoFlashLoan(uint256 flashLoanAmount, bytes calldata data) external onlyMorpho {
        (
            address leverageToken,
            IERC20 assetIn,
            IERC20 assetOut,
            uint256 amountOut,
            RebalanceType rebalanceType,
            IMulticallExecutor multicallExecutor,
            IMulticallExecutor.Call[] memory swapCalls
        ) = abi.decode(
            data, (address, IERC20, IERC20, uint256, RebalanceType, IMulticallExecutor, IMulticallExecutor.Call[])
        );

        RebalanceAction[] memory rebalanceActions = new RebalanceAction[](2);

        // If rebalance type is rebalance down this means that we need to add collateral and borrow debt
        // Otherwise we need to repay debt and remove collateral
        if (rebalanceType == RebalanceType.REBALANCE_DOWN) {
            rebalanceActions[0] = RebalanceAction({actionType: ActionType.AddCollateral, amount: flashLoanAmount});
            rebalanceActions[1] = RebalanceAction({actionType: ActionType.Borrow, amount: amountOut});
        } else {
            rebalanceActions[0] = RebalanceAction({actionType: ActionType.Repay, amount: flashLoanAmount});
            rebalanceActions[1] = RebalanceAction({actionType: ActionType.RemoveCollateral, amount: amountOut});
        }

        // Execute the rebalance
        SafeERC20.forceApprove(assetIn, address(leverageManager), flashLoanAmount);
        leverageManager.rebalance(
            leverageToken, rebalanceActions, address(assetIn), address(assetOut), flashLoanAmount, amountOut
        );

        // Transfer the assets received from the rebalance to the multicall executor for swapping
        SafeERC20.safeTransfer(assetOut, address(multicallExecutor), amountOut);

        // Execute the swap using the multicall executor. Multicall executor will sweep any remaining tokens to this contract
        // after executing the swap calls
        IERC20[] memory tokens = new IERC20[](2);
        tokens[0] = assetIn;
        tokens[1] = assetOut;
        multicallExecutor.multicallAndSweep(swapCalls, tokens);

        // Repay flash loan from Morpho
        SafeERC20.forceApprove(assetIn, msg.sender, flashLoanAmount);
    }
}
