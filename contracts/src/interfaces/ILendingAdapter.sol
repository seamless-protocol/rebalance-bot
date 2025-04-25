// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface ILendingAdapter {
    function getCollateralAsset() external view returns (address);

    function getDebtAsset() external view returns (address);
}
