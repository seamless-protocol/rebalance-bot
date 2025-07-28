// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {SimpleTransferHandler} from "../src/SimpleTransferHandler.sol";

contract DeploySample is Script {
  function run() public {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    address deployerAddress = vm.addr(deployerPrivateKey);

    console.log("Deployer address: ", deployerAddress);
    console.log("Deployer balance: ", deployerAddress.balance);
    console.log("BlockNumber: ", block.number);
    console.log("ChainId: ", block.chainid);

    console.log("Deploying...");

    vm.startBroadcast(deployerPrivateKey);

    SimpleTransferHandler simpleTransferHandler = new SimpleTransferHandler();
    console.log("SimpleTransferHandler deployed to:", address(simpleTransferHandler));

    vm.stopBroadcast();
  }
}
