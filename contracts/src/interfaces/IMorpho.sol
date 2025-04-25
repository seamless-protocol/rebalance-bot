// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IMorpho {
    function flashLoan(address token, uint256 amount, bytes calldata data) external;
}
