// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { WorldcoinCompliance } from "../src/compliance/WorldcoinCompliance.sol";
import { MockWorldID } from "./mocks/MockWorldID.sol";
import { IWorldID } from "../src/interfaces/IWorldID.sol";

/// @title WorldcoinComplianceTest
/// @notice Tests for the WorldcoinCompliance contract
contract WorldcoinComplianceTest is Test {
    WorldcoinCompliance public compliance;
    MockWorldID public mockWorldId;

    address public owner;
    address public hookAddr;
    address public alice;
    address public bob;
    address public charlie;

    uint256 public constant DEFAULT_DAILY_LIMIT = 10_000 * 1e6;
    uint256 public constant MINIMUM_AMOUNT = 1e6;

    // Dummy proof values for testing
    uint256 constant ROOT = 12345;
    uint256 constant NULLIFIER_ALICE = 111;
    uint256 constant NULLIFIER_BOB = 222;
    uint256 constant NULLIFIER_CHARLIE = 333;

    function setUp() public {
        owner = address(this);
        hookAddr = makeAddr("hook");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");

        mockWorldId = new MockWorldID();
        compliance = new WorldcoinCompliance(IWorldID(address(mockWorldId)), "astrasend");
        compliance.setHook(hookAddr);
    }

    // ============ Helper ============

    function _dummyProof() internal pure returns (uint256[8] memory) {
        return [uint256(0), 0, 0, 0, 0, 0, 0, 0];
    }

    function _verifyUser(address user, uint256 nullifier) internal {
        compliance.verifyAndRegister(user, ROOT, nullifier, _dummyProof());
    }

    // ============ Constructor Tests ============

    function test_Constructor() public view {
        assertEq(address(compliance.worldId()), address(mockWorldId));
        assertEq(compliance.defaultDailyLimit(), DEFAULT_DAILY_LIMIT);
        assertEq(compliance.minimumAmount(), MINIMUM_AMOUNT);
    }

    function test_Constructor_RevertIfZeroWorldId() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        new WorldcoinCompliance(IWorldID(address(0)), "astrasend");
    }

    // ============ Verification Tests ============

    function test_VerifyAndRegister_Success() public {
        assertFalse(compliance.isVerified(alice));

        _verifyUser(alice, NULLIFIER_ALICE);

        assertTrue(compliance.isVerified(alice));
        assertTrue(compliance.nullifierHashes(NULLIFIER_ALICE));
    }

    function test_VerifyAndRegister_MultipleUsers() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        _verifyUser(bob, NULLIFIER_BOB);

        assertTrue(compliance.isVerified(alice));
        assertTrue(compliance.isVerified(bob));
        assertFalse(compliance.isVerified(charlie));
    }

    function test_VerifyAndRegister_RevertIfNullifierAlreadyUsed() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        // Try to use same nullifier for bob
        vm.expectRevert(abi.encodeWithSignature("NullifierAlreadyUsed()"));
        compliance.verifyAndRegister(bob, ROOT, NULLIFIER_ALICE, _dummyProof());
    }

    function test_VerifyAndRegister_RevertIfZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        compliance.verifyAndRegister(address(0), ROOT, NULLIFIER_ALICE, _dummyProof());
    }

    function test_VerifyAndRegister_RevertIfProofFails() public {
        mockWorldId.setRejectAll(true);

        vm.expectRevert("MockWorldID: all proofs rejected");
        compliance.verifyAndRegister(alice, ROOT, NULLIFIER_ALICE, _dummyProof());
    }

    function test_VerifyAndRegister_RevertIfSpecificNullifierRejected() public {
        mockWorldId.setRejectNullifier(NULLIFIER_ALICE, true);

        vm.expectRevert("MockWorldID: nullifier rejected");
        compliance.verifyAndRegister(alice, ROOT, NULLIFIER_ALICE, _dummyProof());
    }

    function test_VerifyAndRegister_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit WorldcoinCompliance.WorldIDVerified(alice, NULLIFIER_ALICE);

        _verifyUser(alice, NULLIFIER_ALICE);
    }

    // ============ Compliance Check Tests ============

    function test_IsCompliant_VerifiedUser() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        assertTrue(compliance.isCompliant(alice, bob, 100 * 1e6));
    }

    function test_IsCompliant_UnverifiedUser() public {
        assertFalse(compliance.isCompliant(alice, bob, 100 * 1e6));
    }

    function test_IsCompliant_BlockedSender() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        compliance.addToBlocklist(alice);

        assertFalse(compliance.isCompliant(alice, bob, 100 * 1e6));
    }

    function test_IsCompliant_BlockedRecipient() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        compliance.addToBlocklist(bob);

        assertFalse(compliance.isCompliant(alice, bob, 100 * 1e6));
    }

    function test_IsCompliant_BelowMinimum() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        assertFalse(compliance.isCompliant(alice, bob, MINIMUM_AMOUNT - 1));
    }

    function test_IsCompliant_ExceedsDailyLimit() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        assertFalse(compliance.isCompliant(alice, bob, DEFAULT_DAILY_LIMIT + 1));
    }

    function test_IsCompliant_WithDailyUsage() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        // Record some usage
        vm.prank(hookAddr);
        compliance.recordUsage(alice, 8_000 * 1e6);

        // Within remaining limit
        assertTrue(compliance.isCompliant(alice, bob, 2_000 * 1e6));

        // Exceeds remaining limit
        assertFalse(compliance.isCompliant(alice, bob, 2_001 * 1e6));
    }

    // ============ Daily Limit Tests ============

    function test_DailyLimitTracking() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        vm.prank(hookAddr);
        compliance.recordUsage(alice, 5_000 * 1e6);

        (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit) = compliance.getComplianceStatus(alice);
        assertTrue(isAllowed);
        assertEq(dailyUsed, 5_000 * 1e6);
        assertEq(dailyLimit, DEFAULT_DAILY_LIMIT);
    }

    function test_DailyLimitResetsNextDay() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        vm.prank(hookAddr);
        compliance.recordUsage(alice, DEFAULT_DAILY_LIMIT);

        assertFalse(compliance.isCompliant(alice, bob, 1e6));

        // Warp to next day
        vm.warp(block.timestamp + 1 days);

        assertTrue(compliance.isCompliant(alice, bob, 1e6));
    }

    function test_CustomDailyLimit() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        uint256 customLimit = 50_000 * 1e6;
        compliance.updateDailyLimit(alice, customLimit);

        assertEq(compliance.getDailyLimit(alice), customLimit);
        assertTrue(compliance.isCompliant(alice, bob, 20_000 * 1e6));
    }

    function test_RemainingDailyLimit() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        assertEq(compliance.getRemainingDailyLimit(alice), DEFAULT_DAILY_LIMIT);

        vm.prank(hookAddr);
        compliance.recordUsage(alice, 3_000 * 1e6);

        assertEq(compliance.getRemainingDailyLimit(alice), 7_000 * 1e6);
    }

    function test_RemainingDailyLimit_ExhaustedReturnsZero() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        vm.prank(hookAddr);
        compliance.recordUsage(alice, DEFAULT_DAILY_LIMIT);

        assertEq(compliance.getRemainingDailyLimit(alice), 0);
    }

    // ============ Blocklist Tests ============

    function test_AddToBlocklist() public {
        compliance.addToBlocklist(alice);
        assertTrue(compliance.isBlocked(alice));
    }

    function test_RemoveFromBlocklist() public {
        compliance.addToBlocklist(alice);
        compliance.removeFromBlocklist(alice);
        assertFalse(compliance.isBlocked(alice));
    }

    function test_AddToBlocklist_RevertIfZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        compliance.addToBlocklist(address(0));
    }

    function test_AddToBlocklist_RevertIfAlreadyBlocked() public {
        compliance.addToBlocklist(alice);

        vm.expectRevert(abi.encodeWithSignature("AlreadyBlocked()"));
        compliance.addToBlocklist(alice);
    }

    function test_RemoveFromBlocklist_RevertIfNotBlocked() public {
        vm.expectRevert(abi.encodeWithSignature("NotBlocked()"));
        compliance.removeFromBlocklist(alice);
    }

    // ============ Admin Tests ============

    function test_SetHook() public {
        address newHook = makeAddr("newHook");
        compliance.setHook(newHook);
        assertEq(compliance.hook(), newHook);
    }

    function test_SetHook_RevertIfZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAddress()"));
        compliance.setHook(address(0));
    }

    function test_SetDefaultDailyLimit() public {
        uint256 newLimit = 50_000 * 1e6;
        compliance.setDefaultDailyLimit(newLimit);
        assertEq(compliance.defaultDailyLimit(), newLimit);
    }

    function test_SetDefaultDailyLimit_RevertIfZero() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        compliance.setDefaultDailyLimit(0);
    }

    function test_SetMinimumAmount() public {
        uint256 newMin = 10 * 1e6;
        compliance.setMinimumAmount(newMin);
        assertEq(compliance.minimumAmount(), newMin);
    }

    function test_RevokeVerification() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        assertTrue(compliance.isVerified(alice));

        compliance.revokeVerification(alice);
        assertFalse(compliance.isVerified(alice));
    }

    function test_RevokeVerification_MakesNonCompliant() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        assertTrue(compliance.isCompliant(alice, bob, 100 * 1e6));

        compliance.revokeVerification(alice);
        assertFalse(compliance.isCompliant(alice, bob, 100 * 1e6));
    }

    function test_RecordUsage_RevertIfNotHook() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("NotAuthorized()"));
        compliance.recordUsage(alice, 100 * 1e6);
    }

    function test_AdminFunctions_RevertIfNotOwner() public {
        vm.startPrank(alice);

        vm.expectRevert();
        compliance.setHook(alice);

        vm.expectRevert();
        compliance.addToBlocklist(bob);

        vm.expectRevert();
        compliance.setDefaultDailyLimit(1e6);

        vm.expectRevert();
        compliance.revokeVerification(bob);

        vm.stopPrank();
    }

    // ============ ComplianceStatus Tests ============

    function test_GetComplianceStatus_Verified() public {
        _verifyUser(alice, NULLIFIER_ALICE);

        (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit) = compliance.getComplianceStatus(alice);
        assertTrue(isAllowed);
        assertEq(dailyUsed, 0);
        assertEq(dailyLimit, DEFAULT_DAILY_LIMIT);
    }

    function test_GetComplianceStatus_Unverified() public view {
        (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit) = compliance.getComplianceStatus(alice);
        assertFalse(isAllowed);
        assertEq(dailyUsed, 0);
        assertEq(dailyLimit, DEFAULT_DAILY_LIMIT);
    }

    function test_GetComplianceStatus_VerifiedButBlocked() public {
        _verifyUser(alice, NULLIFIER_ALICE);
        compliance.addToBlocklist(alice);

        (bool isAllowed,,) = compliance.getComplianceStatus(alice);
        assertFalse(isAllowed);
    }

    // ============ Integration Test: Swap Compliance into Hook ============

    function test_IntegrationWithHook_ComplianceSwap() public {
        // This test verifies the WorldcoinCompliance can be used as a drop-in
        // replacement for AllowlistCompliance via the ICompliance interface

        // Verify alice
        _verifyUser(alice, NULLIFIER_ALICE);

        // Check via interface
        assertTrue(compliance.isCompliant(alice, bob, 100 * 1e6));

        // Record usage via hook
        vm.prank(hookAddr);
        compliance.recordUsage(alice, 100 * 1e6);

        // Verify usage recorded
        (,uint256 dailyUsed,) = compliance.getComplianceStatus(alice);
        assertEq(dailyUsed, 100 * 1e6);
    }

    // ============ Fuzz Tests ============

    function testFuzz_DailyLimit(uint256 used, uint256 newAmount) public {
        used = bound(used, 0, DEFAULT_DAILY_LIMIT);
        newAmount = bound(newAmount, MINIMUM_AMOUNT, DEFAULT_DAILY_LIMIT);

        _verifyUser(alice, NULLIFIER_ALICE);

        // Record prior usage
        if (used > 0) {
            vm.prank(hookAddr);
            compliance.recordUsage(alice, used);
        }

        bool expected = (used + newAmount) <= DEFAULT_DAILY_LIMIT;
        assertEq(compliance.isCompliant(alice, bob, newAmount), expected);
    }

    function testFuzz_CustomLimit(uint256 customLimit, uint256 amount) public {
        customLimit = bound(customLimit, MINIMUM_AMOUNT, 100_000 * 1e6);
        amount = bound(amount, MINIMUM_AMOUNT, 100_000 * 1e6);

        _verifyUser(alice, NULLIFIER_ALICE);
        compliance.updateDailyLimit(alice, customLimit);

        bool expected = amount <= customLimit;
        assertEq(compliance.isCompliant(alice, bob, amount), expected);
    }
}
