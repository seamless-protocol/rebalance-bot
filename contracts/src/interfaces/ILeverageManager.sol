// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeverageTokenState} from "src/DataTypes.sol";

interface ILeverageManager {
    function getLeverageTokenRebalanceAdapter(address token) external view returns (address);

    function getLeverageTokenState(address token) external view returns (LeverageTokenState memory state);
}
