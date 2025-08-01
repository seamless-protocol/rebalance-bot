// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {RebalanceHandler} from "../src/RebalanceHandler.sol";
import {ILeverageManager} from "../src/interfaces/ILeverageManager.sol";
contract DeployRebalanceHandler is Script {
  function run() public {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    address deployerAddress = vm.addr(deployerPrivateKey);

    console.log("Deployer address: ", deployerAddress);
    console.log("Deployer balance: ", deployerAddress.balance);
    console.log("BlockNumber: ", block.number);
    console.log("ChainId: ", block.chainid);

    console.log("Deploying...");

    vm.startBroadcast(deployerPrivateKey);

    address leverageManagerAddress = 0x0000000000000000000000000000000000000000;
    ILeverageManager leverageManager = ILeverageManager(leverageManagerAddress);
    RebalanceHandler rebalanceHandler = new RebalanceHandler(leverageManager);
    console.log("RebalanceHandler deployed to:", address(rebalanceHandler));

    vm.stopBroadcast();
  }
}
