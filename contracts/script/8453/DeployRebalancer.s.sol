// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {DutchAuctionRebalancer} from "src/DutchAuctionRebalancer.sol";
import {PreLiquidationRebalancer} from "src/PreLiquidationRebalancer.sol";
import {DeployConstants} from "./DeployConstants.sol";

contract DeployRebalancer is Script {
    address public immutable OWNER = DeployConstants.OWNER;
    address public immutable LEVERAGE_MANAGER = DeployConstants.LEVERAGE_MANAGER;
    address public immutable MORPHO = DeployConstants.MORPHO;

    function run() public {
        address deployerAddress = msg.sender;

        console.log("Deployer address: ", deployerAddress);
        console.log("Deployer balance: ", deployerAddress.balance);
        console.log("BlockNumber: ", block.number);
        console.log("ChainId: ", block.chainid);

        console.log("Owner: ", OWNER);
        console.log("LeverageManager: ", LEVERAGE_MANAGER);
        console.log("Morpho: ", MORPHO);

        console.log("Deploying...");

        vm.startBroadcast();

        PreLiquidationRebalancer preLiquidationRebalancer =
            new PreLiquidationRebalancer(OWNER, LEVERAGE_MANAGER, MORPHO);
        console.log("PreLiquidationRebalancer deployed to:", address(preLiquidationRebalancer));

        DutchAuctionRebalancer dutchAuctionRebalancer = new DutchAuctionRebalancer(OWNER, LEVERAGE_MANAGER, MORPHO);
        console.log("DutchAuctionRebalancer deployed to:", address(dutchAuctionRebalancer));

        vm.stopBroadcast();
    }
}
