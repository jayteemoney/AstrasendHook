// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { PhoneNumberResolver } from "../src/compliance/PhoneNumberResolver.sol";
import { AstraSendHook } from "../src/AstraSendHook.sol";

/// @notice Deploys a new PhoneNumberResolver and updates the hook to point to it.
contract DeployPhoneResolver is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hookAddress = vm.envAddress("HOOK_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        PhoneNumberResolver resolver = new PhoneNumberResolver();
        console.log("PhoneNumberResolver:", address(resolver));

        AstraSendHook(hookAddress).setPhoneResolver(address(resolver));
        console.log("Hook updated to use new resolver");

        vm.stopBroadcast();
    }
}
