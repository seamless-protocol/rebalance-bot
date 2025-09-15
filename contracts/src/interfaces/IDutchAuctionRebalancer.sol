// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {RebalanceStatus, RebalanceType} from "src/DataTypes.sol";
import {IMulticallExecutor} from "./IMulticallExecutor.sol";
import {IRebalanceAdapter} from "./IRebalanceAdapter.sol";

interface IDutchAuctionRebalancer {
    /// @notice Error thrown when the caller is not authorized
    error Unauthorized();

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

    /// @notice Preview the new collateral ratio after taking an auction
    /// @param leverageToken The address of the leverage token
    /// @param amountToTake The amount to take from the auction
    /// @param rebalanceType The rebalance type
    /// @return isAuctionValid Whether the auction is valid / if one exists
    /// @return newCollateralRatio The new collateral ratio, or zero if the auction is not valid
    function previewTakeAuction(address leverageToken, uint256 amountToTake, RebalanceType rebalanceType)
        external
        view
        returns (bool isAuctionValid, uint256 newCollateralRatio);

    /// @notice Transfers the balance of a token held by the contract to an address
    /// @param token The address of the token to sweep
    /// @param to The address to sweep the token to
    function sweepToken(address token, address to) external;

    /// @notice Try to create an auction for a leverage token
    /// @param leverageToken The address of the leverage token
    /// @dev This function will not revert if the auction already exists, it will silently fail (return false)
    function tryCreateAuction(address leverageToken) external;

    /// @notice Take an auction for a leverage token
    /// @param rebalanceAdapter The address of the rebalance adapter
    /// @param flashLoanAsset The asset to flash loan from Morpho
    /// @param rebalanceAssetIn The asset to give for the rebalance
    /// @param rebalanceAssetOut The asset to receive from the rebalance
    /// @param amountToTake The amount to take from the auction
    /// @param multicallExecutor The address of the multicall executor
    /// @param swapCallsAfterRebalance The calls to execute for the swap using the multicall executor after the rebalance
    /// @param swapCallsBeforeRebalance The calls to execute for the swap using the multicall executor before the rebalance
    /// @dev The `swapCallsAfterRebalance` are executed with the assets received from the rebalance to get the assets required to
    /// repay the flash loan
    /// @dev The `swapCallsBeforeRebalance` are executed with the flash loaned assets to get the assets required for the rebalance
    /// @dev The amount of `flashLoanAsset` flash loaned is determined by `rebalanceAdapter.getAmountIn(amountToTake)`
    function takeAuction(
        IRebalanceAdapter rebalanceAdapter,
        IERC20 flashLoanAsset,
        IERC20 rebalanceAssetIn,
        IERC20 rebalanceAssetOut,
        uint256 amountToTake,
        IMulticallExecutor multicallExecutor,
        IMulticallExecutor.Call[] calldata swapCallsAfterRebalance,
        IMulticallExecutor.Call[] calldata swapCallsBeforeRebalance
    ) external;

    /// @notice Called by Morpho when a flash loan is received
    /// @param amount The amount of the flash loan
    /// @param data The data of the flash loan
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external;
}
