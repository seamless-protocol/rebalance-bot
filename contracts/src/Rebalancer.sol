// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus} from "./DataTypes.sol";
import {IRebalancer} from "./interfaces/IRebalancer.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

contract Rebalancer is IRebalancer {
    ILeverageManager public immutable leverageManager;
    ISwapAdapter public immutable swapAdapter;

    constructor(address _leverageManager, address _swapAdapter) {
        leverageManager = ILeverageManager(_leverageManager);
        swapAdapter = ISwapAdapter(_swapAdapter);
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
