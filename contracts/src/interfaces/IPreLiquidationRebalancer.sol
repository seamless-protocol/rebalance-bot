// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {RebalanceType} from "../DataTypes.sol";
import {IMulticallExecutor} from "./IMulticallExecutor.sol";

interface IPreLiquidationRebalancer {
    /// @notice Thrown when caller is not Morpho
    error Unauthorized();

    /// @notice Sweeps token from contract
    /// @param token Address of the token to sweep
    /// @param to Address to send the token to
    function sweepToken(address token, address to) external;

    /// @notice Checks if LT is still eligible for pre liquidation rebalance
    /// @param leverageToken Address of the leverage token to check
    /// @return isEligible true if LT is eligible for pre liquidation rebalance, false otherwise
    function isEligibleForPreLiquidationRebalance(address leverageToken) external view returns (bool isEligible);

    /// @notice Calculates how much debt to give to LM in order to take specified collateral amount
    /// @param leverageToken Address of the leverage token to rebalance
    /// @param amountOut Amount of assets to take from leverage manager from removing collateral or borrowing debt
    /// @return amountIn Amount of debt to give to LM
    /// @dev This function takes pre liquidation reward into account
    function getAmountIn(address leverageToken, uint256 amountOut) external view returns (uint256 amountIn);

    /// @notice Rebalances leverage token before liquidation at takes premium reward
    /// @param leverageToken Address of the leverage token to rebalance
    /// @param amountIn Amount of assets to give to leverage manager for adding collateral or repaying debt
    /// @param amountOut Amount of assets to take from leverage manager from removing collateral or borrowing debt
    /// @param rebalanceType Type of rebalance to perform, rebalance up or rebalance down
    /// @param multicallExecutor The address of the multicall executor
    /// @param swapCalls The calls to execute for the swap using the multicall executor
    /// @dev The `swapCalls` are executed by the multicall executor with assets received from the pre liquidation rebalance
    function preLiquidationRebalance(
        address leverageToken,
        uint256 amountIn,
        uint256 amountOut,
        RebalanceType rebalanceType,
        IMulticallExecutor multicallExecutor,
        IMulticallExecutor.Call[] calldata swapCalls
    ) external;

    /// @notice Called by Morpho when flashloan is executed
    /// @param amount Amount of assets borrowed
    /// @param data Encoded data from preLiquidationRebalance
    function onMorphoFlashLoan(uint256 amount, bytes calldata data) external;
}
