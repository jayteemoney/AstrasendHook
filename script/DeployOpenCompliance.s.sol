// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { OpenCompliance } from "../src/compliance/OpenCompliance.sol";

contract DeployOpenCompliance is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hookAddress = vm.envAddress("HOOK_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        OpenCompliance compliance = new OpenCompliance();
        console.log("OpenCompliance deployed at:", address(compliance));

        compliance.setHook(hookAddress);
        console.log("Hook set to:", hookAddress);

        vm.stopBroadcast();
    }
}
