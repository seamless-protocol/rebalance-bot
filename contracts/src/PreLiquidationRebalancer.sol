// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {LeverageTokenState, RebalanceType, SwapType, SwapData, RebalanceAction, ActionType} from "./DataTypes.sol";
import {ILeverageManager} from "./interfaces/ILeverageManager.sol";
import {IMorpho} from "./interfaces/IMorpho.sol";
import {IPreLiquidationRebalancer} from "./interfaces/IPreLiquidationRebalancer.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";

contract PreLiquidationRebalancer is IPreLiquidationRebalancer, Ownable {
    uint256 public constant REWARD_BASE = 100_00;

    ILeverageManager public immutable leverageManager;
    ISwapAdapter public immutable swapAdapter;
    IMorpho public immutable morpho;

    modifier onlyMorpho() {
        if (msg.sender != address(morpho)) revert Unauthorized();
        _;
    }

    constructor(address _owner, address _leverageManager, address _swapAdapter, address _morpho) Ownable(_owner) {
        leverageManager = ILeverageManager(_leverageManager);
        swapAdapter = ISwapAdapter(_swapAdapter);
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
        SwapData memory swapData
    ) external {
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
            assetIn, amountIn, abi.encode(leverageToken, assetIn, assetOut, amountOut, rebalanceType, swapData)
        );
    }

    /// @inheritdoc IPreLiquidationRebalancer
    function onMorphoFlashLoan(uint256 amountIn, bytes calldata data) external onlyMorpho {
        (
            address leverageToken,
            address assetIn,
            address assetOut,
            uint256 amountOut,
            RebalanceType rebalanceType,
            SwapData memory swapData
        ) = abi.decode(data, (address, address, address, uint256, RebalanceType, SwapData));

        RebalanceAction[] memory rebalanceActions = new RebalanceAction[](2);

        // If rebalance type is rebalance down this means that we need to add collateral and borrow debt
        // Otherwise we need to repay debt and remove collateral
        if (rebalanceType == RebalanceType.REBALANCE_DOWN) {
            rebalanceActions[0] = RebalanceAction({actionType: ActionType.AddCollateral, amount: amountIn});
            rebalanceActions[1] = RebalanceAction({actionType: ActionType.Borrow, amount: amountOut});
        } else {
            rebalanceActions[0] = RebalanceAction({actionType: ActionType.Repay, amount: amountIn});
            rebalanceActions[1] = RebalanceAction({actionType: ActionType.RemoveCollateral, amount: amountOut});
        }

        // Execute actual rebalance
        IERC20(assetIn).approve(address(leverageManager), amountIn);

        leverageManager.rebalance(leverageToken, rebalanceActions, assetIn, assetOut, amountIn, amountOut);

        // Execute swap to repay flashloan
        // If swap type is exact input or exact output execute it on swap adapter
        // If swap type is lifi swap execute it on lifi target
        // This data should be fetched off-chain and passed as a parameter
        if (swapData.swapType == SwapType.EXACT_INPUT_SWAP_ADAPTER) {
            _swapExactInputOnSwapAdapter(assetOut, amountOut, amountIn, swapData.swapContext);
        } else if (swapData.swapType == SwapType.EXACT_OUTPUT_SWAP_ADAPTER) {
            _swapExactOutputOnSwapAdapter(assetOut, amountIn, amountOut, swapData.swapContext);
        } else if (swapData.swapType == SwapType.LIFI_SWAP) {
            address lifiTarget = swapData.lifiSwap.to;
            bytes memory lifiCallData = swapData.lifiSwap.data;
            _swapLIFI(IERC20(assetOut), amountOut, lifiTarget, lifiCallData);
        }

        IERC20(assetIn).approve(msg.sender, amountIn);
    }

    /// @notice Swaps exact input on swap adapter
    /// @param inputToken Address of the input token
    /// @param inputAmount Amount of input tokens to swap
    /// @param minOutputAmount Minimum amount of output tokens to receive
    /// @param swapContext Swap context for swap adapter
    function _swapExactInputOnSwapAdapter(
        address inputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), inputAmount);
        swapAdapter.swapExactInput(inputToken, inputAmount, minOutputAmount, swapContext);
    }

    /// @notice Swaps exact output on swap adapter
    /// @param inputToken Address of the input token
    /// @param outputAmount Amount of output tokens to receive
    /// @param maxInputAmount Maximum amount of input tokens to spend
    /// @param swapContext Swap context for swap adapter
    function _swapExactOutputOnSwapAdapter(
        address inputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), maxInputAmount);
        swapAdapter.swapExactOutput(inputToken, outputAmount, maxInputAmount, swapContext);
    }

    /// @notice Swaps on lifi target
    /// @param inputToken Address of the input token
    /// @param inputAmount Amount of input tokens to swap
    /// @param target Address of the lifi target
    /// @param data Data for the lifi target
    function _swapLIFI(IERC20 inputToken, uint256 inputAmount, address target, bytes memory data) internal {
        SafeERC20.forceApprove(inputToken, target, inputAmount);

        (bool success,) = target.call(data);
        if (!success) revert LIFISwapFailed();
    }
}
