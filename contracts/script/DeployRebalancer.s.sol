// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {Rebalancer} from "src/Rebalancer.sol";

contract DeployRebalancer is Script {
    address public immutable OWNER = vm.envAddress("OWNER");
    address public immutable LEVERAGE_MANAGER = vm.envAddress("LEVERAGE_MANAGER");
    address public immutable SWAP_ADAPTER = vm.envAddress("SWAP_ADAPTER");
    address public immutable MORPHO = vm.envAddress("MORPHO");

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
        Rebalancer rebalancer = new Rebalancer(OWNER, LEVERAGE_MANAGER, SWAP_ADAPTER, MORPHO);
        console.log("Rebalancer deployed to:", address(rebalancer));

        vm.stopBroadcast();
    }
}
