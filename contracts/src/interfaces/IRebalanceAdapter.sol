// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeverageTokenState} from "src/DataTypes.sol";

interface IRebalanceAdapter {
    function isEligibleForRebalance(address token, LeverageTokenState memory state, address caller)
        external
        view
        returns (bool isEligible);

    function getCollateralRatioThreshold() external view returns (uint256);

    function isAuctionValid() external view returns (bool isValid);

    function getAmountIn(uint256 amountToTake) external view returns (uint256 amountIn);

    function getRebalanceReward() external view returns (uint256);

    function createAuction() external;

    function take(uint256 amount) external;
}
