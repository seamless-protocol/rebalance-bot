// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {StakeData, SwapData, RebalanceStatus, RebalanceType} from "src/DataTypes.sol";

interface IRebalancer {
    /// @notice Error thrown when the caller is not authorized
    error Unauthorized();

    /// @notice Error thrown when the LIFI swap fails
    error LIFISwapFailed();

    /// @notice Emitted when a tryCreateAuction call is made, status of the leverage token and whether the auction was created
    event TryCreateAuction(address indexed leverageToken, RebalanceStatus indexed status, bool indexed auctionCreated);

    /// @notice Get the rebalance status of a leverage token
    /// @param leverageToken The address of the leverage token
    /// @return status The rebalance status of the leverage token
    /// @dev The rebalance status is one of the following:
    /// - NOT_ELIGIBLE: The leverage token is not eligible for rebalancing
    /// - DUTCH_AUCTION_ELIGIBLE: The leverage token is eligible for Dutch rebalancing
    /// - PRE_LIQUIDATION_ELIGIBLE: The leverage token is eligible for pre-liquidation rebalancing
    function getRebalanceStatus(address leverageToken) external view returns (RebalanceStatus status);

    /// @notice Transfers the balance of a token held by the contract to an address
    /// @param token The address of the token to sweep
    /// @param to The address to sweep the token to
    function sweepToken(address token, address to) external;

    /// @notice Try to create an auction for a leverage token
    /// @param leverageToken The address of the leverage token
    /// @dev This function will not revert if the auction already exists, it will silently fail (return false)
    function tryCreateAuction(address leverageToken) external;

    /// @notice Take an auction for a leverage token
    /// @param leverageToken The address of the leverage token
    /// @param amountToTake The amount to take from the auction
    /// @param swapData The swap data for the auction
    /// @param stakeData The stake data for the auction
    /// @dev If stakeData.stakeType != NONE, the contract will flash loan stakeData.assetIn and stake it to stakeData.stakeTo
    /// and use the resulting staked asset as the assetIn for the auction
    function takeAuction(
        address leverageToken,
        uint256 amountToTake,
        RebalanceType rebalanceType,
        SwapData memory swapData,
        StakeData memory stakeData
    ) external;

    /// @notice Called by Morpho when a flash loan is received
    /// @param amount The amount of the flash loan
    /// @param data The data of the flash loan
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external;
}
