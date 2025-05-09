// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {Rebalancer} from "src/Rebalancer.sol";

contract DeployRebalancer is Script {
    address public constant OWNER = 0x0000000000000000000000000000000000000000;
    address public constant LEVERAGE_MANAGER = 0x0000000000000000000000000000000000000000;
    address public constant SWAP_ADAPTER = 0x0000000000000000000000000000000000000000;
    address public constant MORPHO = 0x0000000000000000000000000000000000000000;

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
        console.log("    owner: ", OWNER);
        console.log("    leverageManager: ", LEVERAGE_MANAGER);
        console.log("    swapAdapter: ", SWAP_ADAPTER);
        console.log("    morpho: ", MORPHO);

        vm.stopBroadcast();
    }
}
