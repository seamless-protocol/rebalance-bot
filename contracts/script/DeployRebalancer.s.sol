// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";

import {Rebalancer} from "src/Rebalancer.sol";
import {PreLiquidationRebalancer} from "src/PreLiquidationRebalancer.sol";

contract DeployRebalancer is Script {
    // address public immutable OWNER = vm.envAddress("OWNER");
    // address public immutable LEVERAGE_MANAGER = vm.envAddress("LEVERAGE_MANAGER");
    // address public immutable SWAP_ADAPTER = vm.envAddress("SWAP_ADAPTER");
    // address public immutable MORPHO = vm.envAddress("MORPHO");
    // address public immutable WETH = vm.envAddress("WETH");

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
        // Rebalancer rebalancer = new Rebalancer(OWNER, LEVERAGE_MANAGER, SWAP_ADAPTER, MORPHO, WETH);

        PreLiquidationRebalancer preLiquidationRebalancer = new PreLiquidationRebalancer(
         0xf55Af0D2ee9B645D2DE0247353a7bAD71863e28F   ,
         0x3887f0555399FfB97EC62B7f8F99290d5007e769 ,
         0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb );

         Rebalancer rebalancer = new Rebalancer(
          deployerAddress,
          0xf55Af0D2ee9B645D2DE0247353a7bAD71863e28F,
          0x3887f0555399FfB97EC62B7f8F99290d5007e769,
          0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb,
          0x4200000000000000000000000000000000000006
         );
         console.log("Rebalancer deployed to:", address(rebalancer));


        console.log("PreLiquidationRebalancer deployed to:", address(preLiquidationRebalancer));



        // console.log("Rebalancer deployed to:", address(rebalancer));
        // console.log("    OWNER: ", rebalancer.owner());
        // console.log("    LEVERAGE_MANAGER: ", address(rebalancer.leverageManager()));
        // console.log("    SWAP_ADAPTER: ", address(rebalancer.swapAdapter()));
        // console.log("    MORPHO: ", address(rebalancer.morpho()));
        // console.log("    WETH: ", address(rebalancer.weth()));

        vm.stopBroadcast();
    }
}
