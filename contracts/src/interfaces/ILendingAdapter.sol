// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface ILendingAdapter {
    function getCollateralAsset() external view returns (address);

    function getDebtAsset() external view returns (address);

    function getCollateral() external view returns (uint256);

    function getDebt() external view returns (uint256);

    function convertCollateralToDebtAsset(uint256 amount) external view returns (uint256);

    function getLiquidationPenalty() external view returns (uint256);
}
