// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeverageTokenState, RebalanceAction} from "src/DataTypes.sol";

interface ILeverageManager {
    function getLeverageTokenRebalanceAdapter(address token) external view returns (address);

    function getLeverageTokenLendingAdapter(address token) external view returns (address);

    function getLeverageTokenState(address token) external view returns (LeverageTokenState memory state);

    function rebalance(
        address leverageToken,
        RebalanceAction[] calldata actions,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) external;
}
