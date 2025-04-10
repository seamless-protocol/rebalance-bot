// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeverageTokenState} from "src/DataTypes.sol";

interface IRebalanceAdapter {
    function isEligibleForRebalance(address token, LeverageTokenState memory state, address caller)
        external
        view
        returns (bool isEligible);
}
