// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AstraSendHook } from "../src/AstraSendHook.sol";
import { AllowlistCompliance } from "../src/compliance/AllowlistCompliance.sol";
import { WorldcoinCompliance } from "../src/compliance/WorldcoinCompliance.sol";
import { PhoneNumberResolver } from "../src/compliance/PhoneNumberResolver.sol";
import { ICompliance } from "../src/interfaces/ICompliance.sol";

/// @title SetupDemo
/// @notice Script to set up demo data for UHI8 presentation
/// @dev Run after deployment to populate test data
contract SetupDemo is Script {
    // ============ Demo Configuration ============

    // Demo phone numbers for different corridors
    string constant KENYA_PHONE = "+254712345678";
    string constant NIGERIA_PHONE = "+2348061234567";
    string constant GHANA_PHONE = "+233201234567";
    string constant UGANDA_PHONE = "+256701234567";
    string constant UK_PHONE = "+447911123456";
    string constant USA_PHONE = "+14155551234";

    // ============ Contract References ============

    AstraSendHook public hook;
    AllowlistCompliance public compliance;
    PhoneNumberResolver public phoneResolver;

    // ============ Main Setup Function ============

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load deployed contract addresses
        hook = AstraSendHook(vm.envAddress("HOOK_ADDRESS"));
        compliance = AllowlistCompliance(vm.envAddress("COMPLIANCE_ADDRESS"));
        phoneResolver = PhoneNumberResolver(vm.envAddress("PHONE_RESOLVER_ADDRESS"));

        console.log("Setting up demo data...");
        console.log("Hook:", address(hook));
        console.log("Compliance:", address(compliance));
        console.log("PhoneResolver:", address(phoneResolver));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Setup demo wallets and phone numbers
        _setupDemoWallets();

        // 2. Setup demo remittances (optional)
        // _setupDemoRemittances();

        vm.stopBroadcast();

        console.log("\n========== DEMO SETUP COMPLETE ==========");
    }

    // ============ Setup Demo Wallets ============

    function _setupDemoWallets() internal {
        console.log("\nSetting up demo wallets...");

        // Create demo wallet addresses (deterministic for testing)
        address kenyaWallet = _createDemoWallet("kenya_recipient");
        address nigeriaWallet = _createDemoWallet("nigeria_recipient");
        address ghanaWallet = _createDemoWallet("ghana_recipient");
        address ugandaWallet = _createDemoWallet("uganda_recipient");
        address ukSender = _createDemoWallet("uk_sender");
        address usaSender = _createDemoWallet("usa_sender");

        // Register phone numbers
        _registerPhoneIfNotExists(KENYA_PHONE, kenyaWallet);
        _registerPhoneIfNotExists(NIGERIA_PHONE, nigeriaWallet);
        _registerPhoneIfNotExists(GHANA_PHONE, ghanaWallet);
        _registerPhoneIfNotExists(UGANDA_PHONE, ugandaWallet);
        _registerPhoneIfNotExists(UK_PHONE, ukSender);
        _registerPhoneIfNotExists(USA_PHONE, usaSender);

        // Add all to compliance allowlist
        _addToAllowlistIfNotExists(kenyaWallet, 0);
        _addToAllowlistIfNotExists(nigeriaWallet, 0);
        _addToAllowlistIfNotExists(ghanaWallet, 0);
        _addToAllowlistIfNotExists(ugandaWallet, 0);
        _addToAllowlistIfNotExists(ukSender, 0);
        _addToAllowlistIfNotExists(usaSender, 0);

        // Log demo wallet addresses
        console.log("\nDemo Wallets:");
        console.log("Kenya Recipient:", kenyaWallet);
        console.log("Nigeria Recipient:", nigeriaWallet);
        console.log("Ghana Recipient:", ghanaWallet);
        console.log("Uganda Recipient:", ugandaWallet);
        console.log("UK Sender:", ukSender);
        console.log("USA Sender:", usaSender);

        // Log phone hashes for reference
        console.log("\nPhone Hashes:");
        console.log("Kenya:", vm.toString(_computePhoneHash(KENYA_PHONE)));
        console.log("Nigeria:", vm.toString(_computePhoneHash(NIGERIA_PHONE)));
        console.log("Ghana:", vm.toString(_computePhoneHash(GHANA_PHONE)));
        console.log("Uganda:", vm.toString(_computePhoneHash(UGANDA_PHONE)));
        console.log("UK:", vm.toString(_computePhoneHash(UK_PHONE)));
        console.log("USA:", vm.toString(_computePhoneHash(USA_PHONE)));
    }

    // ============ Helper Functions ============

    function _createDemoWallet(string memory label) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked("astrasend_demo_", label)))));
    }

    function _computePhoneHash(string memory phone) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(phone));
    }

    function _registerPhoneIfNotExists(string memory phone, address wallet) internal {
        bytes32 phoneHash = _computePhoneHash(phone);

        if (!phoneResolver.isRegistered(phoneHash)) {
            phoneResolver.registerPhoneString(phone, wallet);
            console.log("Registered phone:", phone);
        } else {
            console.log("Phone already registered:", phone);
        }
    }

    function _addToAllowlistIfNotExists(address account, uint256 customLimit) internal {
        if (!compliance.isOnAllowlist(account)) {
            compliance.addToAllowlist(account, customLimit);
            console.log("Added to allowlist:", account);
        }
    }
}

/// @title SetupDemoRemittances
/// @notice Creates sample remittances for demo purposes
contract SetupDemoRemittances is Script {
    AstraSendHook public hook;
    AllowlistCompliance public compliance;
    PhoneNumberResolver public phoneResolver;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        hook = AstraSendHook(vm.envAddress("HOOK_ADDRESS"));
        compliance = AllowlistCompliance(vm.envAddress("COMPLIANCE_ADDRESS"));
        phoneResolver = PhoneNumberResolver(vm.envAddress("PHONE_RESOLVER_ADDRESS"));

        vm.startBroadcast(deployerPrivateKey);

        // Create demo remittances
        _createDemoRemittances();

        vm.stopBroadcast();
    }

    function _createDemoRemittances() internal {
        console.log("\nCreating demo remittances...");

        // Get recipient address from phone
        bytes32 kenyaPhoneHash = keccak256(abi.encodePacked("+254712345678"));
        address kenyaRecipient = phoneResolver.resolve(kenyaPhoneHash);

        if (kenyaRecipient == address(0)) {
            console.log("Kenya recipient not registered. Run SetupDemo first.");
            return;
        }

        // Create a sample remittance: School Fees
        bytes32 purposeHash = keccak256(abi.encodePacked("School fees for January 2026"));
        uint256 targetAmount = 500 * 1e6; // 500 USDT
        uint256 expiresAt = block.timestamp + 30 days;

        uint256 remittanceId = hook.createRemittance(kenyaRecipient, targetAmount, expiresAt, purposeHash, true);

        console.log("Created remittance ID:", remittanceId);
        console.log("Target amount: 500 USDT");
        console.log("Recipient:", kenyaRecipient);
        console.log("Expires:", expiresAt);
    }
}

/// @title AddToAllowlist
/// @notice Utility script to add addresses to allowlist
contract AddToAllowlist is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        AllowlistCompliance compliance = AllowlistCompliance(vm.envAddress("COMPLIANCE_ADDRESS"));

        // Parse addresses from environment (comma-separated)
        string memory addressesStr = vm.envString("ADDRESSES");
        uint256 customLimit = vm.envOr("CUSTOM_LIMIT", uint256(0));

        vm.startBroadcast(deployerPrivateKey);

        // For single address
        address addr = vm.parseAddress(addressesStr);
        if (!compliance.isOnAllowlist(addr)) {
            compliance.addToAllowlist(addr, customLimit);
            console.log("Added to allowlist:", addr);
        } else {
            console.log("Already on allowlist:", addr);
        }

        vm.stopBroadcast();
    }
}

/// @title RegisterPhone
/// @notice Utility script to register phone numbers
contract RegisterPhone is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        PhoneNumberResolver phoneResolver = PhoneNumberResolver(vm.envAddress("PHONE_RESOLVER_ADDRESS"));

        string memory phoneNumber = vm.envString("PHONE_NUMBER");
        address wallet = vm.envAddress("WALLET_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        bytes32 phoneHash = keccak256(abi.encodePacked(phoneNumber));

        if (!phoneResolver.isRegistered(phoneHash)) {
            phoneResolver.registerPhoneString(phoneNumber, wallet);
            console.log("Registered phone:", phoneNumber);
            console.log("Wallet:", wallet);
            console.log("Phone hash:", vm.toString(phoneHash));
        } else {
            console.log("Phone already registered:", phoneNumber);
        }

        vm.stopBroadcast();
    }
}

/// @title CreateRemittance
/// @notice Utility script to create a remittance
contract CreateRemittance is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        AstraSendHook hook = AstraSendHook(vm.envAddress("HOOK_ADDRESS"));

        address recipient = vm.envAddress("RECIPIENT");
        uint256 targetAmount = vm.envUint("TARGET_AMOUNT");
        uint256 expiresIn = vm.envOr("EXPIRES_IN_DAYS", uint256(30));
        bool autoRelease = vm.envOr("AUTO_RELEASE", true);
        string memory purpose = vm.envOr("PURPOSE", string("Remittance"));

        vm.startBroadcast(deployerPrivateKey);

        uint256 expiresAt = expiresIn > 0 ? block.timestamp + (expiresIn * 1 days) : 0;
        bytes32 purposeHash = keccak256(abi.encodePacked(purpose));

        uint256 remittanceId = hook.createRemittance(recipient, targetAmount, expiresAt, purposeHash, autoRelease);

        console.log("Created remittance:");
        console.log("ID:", remittanceId);
        console.log("Recipient:", recipient);
        console.log("Target:", targetAmount);
        console.log("Expires:", expiresAt);
        console.log("Auto-release:", autoRelease);

        vm.stopBroadcast();
    }
}

/// @title Contribute
/// @notice Utility script to contribute to a remittance
contract Contribute is Script {
    function run() external {
        uint256 contributorPrivateKey = vm.envUint("PRIVATE_KEY");
        AstraSendHook hook = AstraSendHook(vm.envAddress("HOOK_ADDRESS"));
        address supportedToken = vm.envAddress("SUPPORTED_TOKEN");

        uint256 remittanceId = vm.envUint("REMITTANCE_ID");
        uint256 amount = vm.envUint("AMOUNT");

        vm.startBroadcast(contributorPrivateKey);

        // Approve hook to spend tokens
        IERC20(supportedToken).approve(address(hook), amount);

        // Contribute
        hook.contributeDirectly(remittanceId, amount);

        console.log("Contributed to remittance:", remittanceId);
        console.log("Amount:", amount);

        vm.stopBroadcast();
    }
}
