// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {DutchAuctionRebalancer} from "src/DutchAuctionRebalancer.sol";
import {PreLiquidationRebalancer} from "src/PreLiquidationRebalancer.sol";

contract DeployRebalancer is Script {
    address public immutable OWNER = vm.envAddress("OWNER");
    address public immutable LEVERAGE_MANAGER = vm.envAddress("LEVERAGE_MANAGER");
    address public immutable SWAP_ADAPTER = vm.envAddress("SWAP_ADAPTER");
    address public immutable MORPHO = vm.envAddress("MORPHO");
    address public immutable WETH = vm.envAddress("WETH");

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deployer address: ", deployerAddress);
        console.log("Deployer balance: ", deployerAddress.balance);
        console.log("BlockNumber: ", block.number);
        console.log("ChainId: ", block.chainid);

        console.log("Deploying...");

        vm.startBroadcast(deployerPrivateKey);

        PreLiquidationRebalancer preLiquidationRebalancer =
            new PreLiquidationRebalancer(LEVERAGE_MANAGER, SWAP_ADAPTER, MORPHO);
        console.log("PreLiquidationRebalancer deployed to:", address(preLiquidationRebalancer));

        DutchAuctionRebalancer dutchAuctionRebalancer =
            new DutchAuctionRebalancer(OWNER, LEVERAGE_MANAGER, SWAP_ADAPTER, MORPHO, WETH);
        console.log("DutchAuctionRebalancer deployed to:", address(dutchAuctionRebalancer));

        vm.stopBroadcast();
    }
}
