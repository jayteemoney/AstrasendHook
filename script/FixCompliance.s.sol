// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { AstraSendHook } from "../src/AstraSendHook.sol";
import { OpenCompliance } from "../src/compliance/OpenCompliance.sol";
import { ICompliance } from "../src/interfaces/ICompliance.sol";

/// @title FixCompliance
/// @notice Re-wires the compliance <-> hook relationship on deployed testnets.
///         Run this whenever the hook or compliance is redeployed to re-link them.
///
/// Run on Base Sepolia:
///   forge script script/FixCompliance.s.sol:FixComplianceBaseSepolia \
///     --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
///
/// Run on Unichain Sepolia:
///   forge script script/FixCompliance.s.sol:FixComplianceUnichainSepolia \
///     --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast

// ─── Base Sepolia ─────────────────────────────────────────────────────────────

contract FixComplianceBaseSepolia is Script {
    address constant HOOK             = 0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4;
    address constant OPEN_COMPLIANCE  = 0xa15d7d5505BC3D7B74A27808141D86752EfE09b6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        OpenCompliance compliance = OpenCompliance(OPEN_COMPLIANCE);
        AstraSendHook hook = AstraSendHook(HOOK);

        console.log("Current compliance.hook:", compliance.hook());
        compliance.setHook(HOOK);
        console.log("compliance.hook updated to:", compliance.hook());

        console.log("Current hook.compliance:", address(hook.compliance()));
        hook.setCompliance(OPEN_COMPLIANCE);
        console.log("hook.compliance updated to:", address(hook.compliance()));

        vm.stopBroadcast();
    }
}

// ─── Unichain Sepolia ─────────────────────────────────────────────────────────

contract FixComplianceUnichainSepolia is Script {
    address constant HOOK             = 0x31c76772ad6A821F0908AC3c6Caa706a043A98E4;
    address constant OPEN_COMPLIANCE  = 0xBfBD571aCA171167833355e944c5CC8E96FE8A16;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        OpenCompliance compliance = OpenCompliance(OPEN_COMPLIANCE);
        AstraSendHook hook = AstraSendHook(HOOK);

        console.log("Current compliance.hook:", compliance.hook());
        compliance.setHook(HOOK);
        console.log("compliance.hook updated to:", compliance.hook());

        console.log("Current hook.compliance:", address(hook.compliance()));
        hook.setCompliance(OPEN_COMPLIANCE);
        console.log("hook.compliance updated to:", address(hook.compliance()));

        vm.stopBroadcast();
    }
}
