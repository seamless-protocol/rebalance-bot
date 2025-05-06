// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus, SwapData, SwapType, RebalanceType} from "./DataTypes.sol";
import {IRebalancer} from "./interfaces/IRebalancer.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IMorpho} from "./interfaces/IMorpho.sol";

contract Rebalancer is IRebalancer {
    ILeverageManager public immutable leverageManager;
    ISwapAdapter public immutable swapAdapter;
    IMorpho public immutable morpho;

    modifier onlyMorpho() {
        if (msg.sender != address(morpho)) revert Unauthorized();
        _;
    }

    constructor(address _leverageManager, address _swapAdapter, address _morpho) {
        leverageManager = ILeverageManager(_leverageManager);
        swapAdapter = ISwapAdapter(_swapAdapter);
        morpho = IMorpho(_morpho);
    }

    /// @inheritdoc IRebalancer
    function getRebalanceStatus(address leverageToken) public view returns (RebalanceStatus status) {
        IRebalanceAdapter rebalanceAdapter =
            IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

        LeverageTokenState memory leverageTokenState = leverageManager.getLeverageTokenState(leverageToken);

        // If caller can be rebalanceAdapter than it means that strategy is eligible for rebalance through dutch auction
        bool isDutchEligible =
            rebalanceAdapter.isEligibleForRebalance(leverageToken, leverageTokenState, address(rebalanceAdapter));

        // If caller can be any address than it means that strategy is eligible for rebalance also through pre-liquidation
        bool isPreLiquidationEligible =
            rebalanceAdapter.isEligibleForRebalance(leverageToken, leverageTokenState, address(this));

        if (isPreLiquidationEligible) {
            return RebalanceStatus.PRE_LIQUIDATION_ELIGIBLE;
        }

        if (isDutchEligible) {
            return RebalanceStatus.DUTCH_AUCTION_ELIGIBLE;
        }

        return RebalanceStatus.NOT_ELIGIBLE;
    }

    /// @inheritdoc IRebalancer
    function tryCreateAuction(address leverageToken) public {
        RebalanceStatus status = getRebalanceStatus(leverageToken);

        if (status != RebalanceStatus.NOT_ELIGIBLE) {
            IRebalanceAdapter rebalanceAdapter =
                IRebalanceAdapter(leverageManager.getLeverageTokenRebalanceAdapter(leverageToken));

            bool auctionExists = rebalanceAdapter.isAuctionValid();
            if (!auctionExists) {
                rebalanceAdapter.createAuction();
            }
        }

        emit TryCreateAuction(leverageToken, status);
    }

    /// @inheritdoc IRebalancer
    function takeAuction(
        address leverageToken,
        uint256 amountToTake,
        RebalanceType rebalanceType,
        SwapData memory swapData
    ) external {
        address rebalanceAdapter = leverageManager.getLeverageTokenRebalanceAdapter(leverageToken);
        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);

        address assetIn;
        address assetOut;
        uint256 amountIn;

        {
            address collateralAsset = ILendingAdapter(lendingAdapter).getCollateralAsset();
            address debtAsset = ILendingAdapter(lendingAdapter).getDebtAsset();

            assetIn = rebalanceType == RebalanceType.REBALANCE_DOWN ? collateralAsset : debtAsset;
            assetOut = rebalanceType == RebalanceType.REBALANCE_DOWN ? debtAsset : collateralAsset;
            amountIn = IRebalanceAdapter(rebalanceAdapter).getAmountIn(amountToTake);
        }

        morpho.flashLoan(assetIn, amountIn, abi.encode(assetIn, assetOut, rebalanceAdapter, amountToTake, swapData));
    }

    /// @inheritdoc IRebalancer
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external onlyMorpho {
        (address assetIn, address assetOut, address rebalanceAdapter, uint256 amountToTake, SwapData memory swapData) =
            abi.decode(data, (address, address, address, uint256, SwapData));

        IERC20(assetIn).approve(rebalanceAdapter, amount);
        IRebalanceAdapter(rebalanceAdapter).take(amountToTake);

        uint256 assetOutReceived = IERC20(assetOut).balanceOf(address(this));

        if (swapData.swapType == SwapType.EXACT_INPUT_SWAP_ADAPTER) {
            _swapExactInputOnSwapAdapter(assetOut, assetOutReceived, 0, swapData.swapContext);
        } else if (swapData.swapType == SwapType.EXACT_OUTPUT_SWAP_ADAPTER) {
            _swapExactOutputOnSwapAdapter(assetOut, amount, type(uint256).max, swapData.swapContext);
        } else if (swapData.swapType == SwapType.LIFI_SWAP) {
            address lifiTarget = swapData.lifiSwap.to;
            bytes memory lifiCallData = swapData.lifiSwap.data;
            _swapLIFI(IERC20(assetOut), assetOutReceived, lifiTarget, lifiCallData);
        }

        IERC20(assetIn).approve(msg.sender, amount);
    }

    function _swapExactInputOnSwapAdapter(
        address inputToken,
        uint256 inputAmount,
        uint256 minOutputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), inputAmount);
        swapAdapter.swapExactInput(inputToken, inputAmount, minOutputAmount, swapContext);
    }

    function _swapExactOutputOnSwapAdapter(
        address inputToken,
        uint256 outputAmount,
        uint256 maxInputAmount,
        ISwapAdapter.SwapContext memory swapContext
    ) private {
        SafeERC20.forceApprove(IERC20(inputToken), address(swapAdapter), maxInputAmount);
        swapAdapter.swapExactOutput(inputToken, outputAmount, maxInputAmount, swapContext);
    }

    function _swapLIFI(IERC20 inputToken, uint256 inputAmount, address target, bytes memory data) internal {
        SafeERC20.forceApprove(inputToken, target, inputAmount);

        (bool success,) = target.call(data);
        if (!success) revert LIFISwapFailed();
    }
}
