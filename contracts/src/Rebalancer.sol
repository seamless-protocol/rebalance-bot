// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ILeverageManager, LeverageTokenState} from "./interfaces/ILeverageManager.sol";
import {IRebalanceAdapter} from "./interfaces/IRebalanceAdapter.sol";
import {RebalanceStatus} from "./DataTypes.sol";
import {IRebalancer} from "./interfaces/IRebalancer.sol";

contract Rebalancer is IRebalancer {
    /// @inheritdoc IRebalancer
    function getRebalanceStatus(address leverageManager, address leverageToken)
        external
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
            return RebalanceStatus.DUTCH_ELIGIBLE;
        }

        return RebalanceStatus.NOT_ELIGIBLE;
    }
}
