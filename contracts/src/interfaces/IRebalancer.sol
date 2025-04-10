// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {RebalanceStatus} from "src/DataTypes.sol";

interface IRebalancer {
    /// @notice Get the rebalance status of a leverage token
    /// @param leverageManager The address of the leverage manager
    /// @param leverageToken The address of the leverage token
    /// @return status The rebalance status of the leverage token
    /// @dev The rebalance status is one of the following:
    /// - NOT_ELIGIBLE: The leverage token is not eligible for rebalancing
    /// - DUTCH_ELIGIBLE: The leverage token is eligible for Dutch rebalancing
    /// - PRE_LIQUIDATION_ELIGIBLE: The leverage token is eligible for pre-liquidation rebalancing
    function getRebalanceStatus(address leverageManager, address leverageToken)
        external
        view
        returns (RebalanceStatus status);
}
