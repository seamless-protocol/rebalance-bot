// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {Rebalancer} from "src/Rebalancer.sol";

contract DeployRebalancer is Script {
    address public constant LEVERAGE_MANAGER = 0xC070A317F23E9A4e982e356485416251dd3Ed944;
    address public constant SWAP_ADAPTER = 0x380de6769c9ECC5e8D032F8a3904bF17DC852cA5;
    address public constant MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deployer address: ", deployerAddress);
        console.log("Deployer balance: ", deployerAddress.balance);
        console.log("BlockNumber: ", block.number);
        console.log("ChainId: ", block.chainid);

        console.log("Deploying...");

        vm.startBroadcast(deployerPrivateKey);

        // Deploying stateless contract
        Rebalancer rebalancer = new Rebalancer(LEVERAGE_MANAGER, SWAP_ADAPTER, MORPHO);
        console.log("Rebalancer deployed to:", address(rebalancer));

        vm.stopBroadcast();
    }
}
