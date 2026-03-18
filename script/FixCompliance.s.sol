// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { AstraSendHook } from "../src/AstraSendHook.sol";
import { OpenCompliance } from "../src/compliance/OpenCompliance.sol";
import { ICompliance } from "../src/interfaces/ICompliance.sol";

/// @title FixCompliance
/// @notice Switches deployed AstraSendHook contracts from AllowlistCompliance
///         to the OpenCompliance contract so all wallets can transact freely.
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
    // Existing deployed contracts on Base Sepolia (84532)
    address constant HOOK         = 0x90C4eDCF58d203d924C5cAdd8c8A07bc01e798e4;
    address constant OPEN_COMPLIANCE = 0xA4a7E8185C8822CC4E4F460413119da977477254;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AstraSendHook hook = AstraSendHook(HOOK);

        console.log("Current compliance:", address(hook.compliance()));
        console.log("Switching to OpenCompliance:", OPEN_COMPLIANCE);

        hook.setCompliance(OPEN_COMPLIANCE);

        console.log("New compliance:", address(hook.compliance()));
        console.log("Done. All wallets can now transact on Base Sepolia.");

        vm.stopBroadcast();
    }
}

// ─── Unichain Sepolia ─────────────────────────────────────────────────────────

contract FixComplianceUnichainSepolia is Script {
    // Deployed AstraSendHook on Unichain Sepolia (1301)
    address constant HOOK = 0xbC37002Ad169c6f3b39319eECAd65a7364eEd8e4;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy a new OpenCompliance for Unichain Sepolia
        OpenCompliance openCompliance = new OpenCompliance();
        console.log("OpenCompliance deployed at:", address(openCompliance));

        // Point OpenCompliance at the hook so recordUsage works
        openCompliance.setHook(HOOK);
        console.log("OpenCompliance.setHook set to hook");

        // Switch the hook to use OpenCompliance
        AstraSendHook hook = AstraSendHook(HOOK);
        console.log("Current compliance:", address(hook.compliance()));
        hook.setCompliance(address(openCompliance));
        console.log("New compliance:", address(hook.compliance()));

        console.log("Done. All wallets can now transact on Unichain Sepolia.");
        console.log("Save this address to contracts.ts for chain 1301:");
        console.log("  compliance:", address(openCompliance));

        vm.stopBroadcast();
    }
}
