// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {RebalanceStatus} from "src/DataTypes.sol";
import {IMorpho} from "./IMorpho.sol";
import {ILeverageManager} from "./ILeverageManager.sol";

interface IRebalancer {
    /// @notice Emitted when a tryCreateAuction call is made, status of the leverage token is emitted
    event TryCreateAuction(address indexed leverageToken, RebalanceStatus indexed status);

    /// @notice Get the rebalance status of a leverage token
    /// @param leverageManager The address of the leverage manager
    /// @param leverageToken The address of the leverage token
    /// @return status The rebalance status of the leverage token
    /// @dev The rebalance status is one of the following:
    /// - NOT_ELIGIBLE: The leverage token is not eligible for rebalancing
    /// - DUTCH_AUCTION_ELIGIBLE: The leverage token is eligible for Dutch rebalancing
    /// - PRE_LIQUIDATION_ELIGIBLE: The leverage token is eligible for pre-liquidation rebalancing
    function getRebalanceStatus(address leverageManager, address leverageToken)
        external
        view
        returns (RebalanceStatus status);

    /// @notice Try to create an auction for a leverage token
    /// @param leverageManager The address of the leverage manager
    /// @param leverageToken The address of the leverage token
    /// @dev This function will not revert if the auction already exists, it will silently fail (return false)
    function tryCreateAuction(address leverageManager, address leverageToken) external;

    /// @notice Take a rebalance down auction for a leverage token
    /// @param morpho The address of the morpho contract
    /// @param leverageManager The address of the leverage manager
    /// @param leverageToken The address of the leverage token
    /// @param amountToTake The amount of debt to take
    function takeAuctionRebalanceDown(
        IMorpho morpho,
        ILeverageManager leverageManager,
        address leverageToken,
        uint256 amountToTake
    ) external;

    /// @notice Called by morpho when a flash loan is taken
    /// @param amount The amount of debt to take
    /// @param data The data passed to the flash loan
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external;
}
