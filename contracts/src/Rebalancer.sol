// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IMorpho} from "./interfaces/IMorpho.sol";

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRebalancer} from "./interfaces/IRebalancer.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {RebalanceStatus} from "./DataTypes.sol";

contract Rebalancer is IRebalancer {
    /// @inheritdoc IRebalancer
    function getRebalanceStatus(address leverageManager, address leverageToken)
        public
        view
        returns (RebalanceStatus status)
    {
        ILeverageManager leverageManagerContract = ILeverageManager(leverageManager);
        IRebalanceAdapter rebalanceAdapter =
            IRebalanceAdapter(leverageManagerContract.getLeverageTokenRebalanceAdapter(leverageToken));

        LeverageTokenState memory leverageTokenState = leverageManagerContract.getLeverageTokenState(leverageToken);

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
    function tryCreateAuction(address leverageManager, address leverageToken) public {
        RebalanceStatus status = getRebalanceStatus(leverageManager, leverageToken);

        if (status != RebalanceStatus.NOT_ELIGIBLE) {
            ILeverageManager leverageManagerContract = ILeverageManager(leverageManager);
            IRebalanceAdapter rebalanceAdapter =
                IRebalanceAdapter(leverageManagerContract.getLeverageTokenRebalanceAdapter(leverageToken));

            bool auctionExists = rebalanceAdapter.isAuctionValid();
            if (!auctionExists) {
                rebalanceAdapter.createAuction();
            }
        }

        emit TryCreateAuction(leverageToken, status);
    }

    /// @inheritdoc IRebalancer
    function takeAuctionRebalanceDown(
        IMorpho morpho,
        ILeverageManager leverageManager,
        address leverageToken,
        uint256 amountToTake
    ) public {
        address rebalanceAdapter = leverageManager.getLeverageTokenRebalanceAdapter(leverageToken);
        uint256 amountIn = IRebalanceAdapter(rebalanceAdapter).getAmountIn(amountToTake);
        morpho.flashLoan(
            leverageToken, amountIn, abi.encode(leverageManager, leverageToken, rebalanceAdapter, amountToTake)
        );
    }

    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external {
        (ILeverageManager leverageManager, address leverageToken, address rebalanceAdapter, uint256 amountToTake) =
            abi.decode(data, (ILeverageManager, address, address, uint256));

        // Fetch collateral and debt asset for given leverage token
        address lendingAdapter = leverageManager.getLeverageTokenLendingAdapter(leverageToken);
        address collateral = ILendingAdapter(lendingAdapter).getCollateralAsset();
        address debt = ILendingAdapter(lendingAdapter).getDebtAsset();

        IERC20(collateral).approve(rebalanceAdapter, amount);
        IRebalanceAdapter(rebalanceAdapter).take(amountToTake);

        uint256 debtTokenReceived = IERC20(debt).balanceOf(address(this));

        // TODO: Add swap logic here to swap debt to collateral asset

        IERC20(collateral).approve(msg.sender, type(uint256).max);
    }
}
