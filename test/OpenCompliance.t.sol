// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import { OpenCompliance } from "../src/compliance/OpenCompliance.sol";

contract OpenComplianceTest is Test {
    OpenCompliance compliance;
    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        compliance = new OpenCompliance();
        compliance.setHook(address(this)); // so we can call recordUsage
    }

    // ============ Open By Default ============

    function test_AnyoneIsCompliantByDefault() public view {
        assertTrue(compliance.isCompliant(alice, bob, 100e6));
    }

    function test_NewWalletCanSendImmediately() public view {
        address random = address(0x12345);
        assertTrue(compliance.isCompliant(random, bob, 500e6));
    }

    function test_ComplianceStatusShowsAllowedByDefault() public view {
        (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit) = compliance.getComplianceStatus(alice);
        assertTrue(isAllowed);
        assertEq(dailyUsed, 0);
        assertEq(dailyLimit, 10_000e6);
    }

    function test_RemainingDailyLimitFullByDefault() public view {
        assertEq(compliance.getRemainingDailyLimit(alice), 10_000e6);
    }

    function test_NotBlockedByDefault() public view {
        assertFalse(compliance.isBlocked(alice));
    }

    // ============ Blocklist ============

    function test_BlockedUserCannotSend() public {
        compliance.addToBlocklist(alice);
        assertFalse(compliance.isCompliant(alice, bob, 100e6));
    }

    function test_CannotSendToBlockedRecipient() public {
        compliance.addToBlocklist(bob);
        assertFalse(compliance.isCompliant(alice, bob, 100e6));
    }

    function test_UnblockRestoresAccess() public {
        compliance.addToBlocklist(alice);
        assertFalse(compliance.isCompliant(alice, bob, 100e6));

        compliance.removeFromBlocklist(alice);
        assertTrue(compliance.isCompliant(alice, bob, 100e6));
    }

    function test_BlockedStatusReflected() public {
        compliance.addToBlocklist(alice);
        assertTrue(compliance.isBlocked(alice));

        (bool isAllowed,,) = compliance.getComplianceStatus(alice);
        assertFalse(isAllowed);
    }

    function test_RevertDoubleBlock() public {
        compliance.addToBlocklist(alice);
        vm.expectRevert(OpenCompliance.AlreadyBlocked.selector);
        compliance.addToBlocklist(alice);
    }

    function test_RevertUnblockNotBlocked() public {
        vm.expectRevert(OpenCompliance.NotBlocked.selector);
        compliance.removeFromBlocklist(alice);
    }

    // ============ Daily Limits ============

    function test_DailyLimitEnforced() public {
        // Record 9,999 USDT usage
        compliance.recordUsage(alice, 9_999e6);

        // 1 more USDT is still fine
        assertTrue(compliance.isCompliant(alice, bob, 1e6));

        // 2 more USDT exceeds limit
        assertFalse(compliance.isCompliant(alice, bob, 2e6));
    }

    function test_RemainingLimitTracked() public {
        compliance.recordUsage(alice, 3_000e6);
        assertEq(compliance.getRemainingDailyLimit(alice), 7_000e6);
    }

    function test_CustomDailyLimit() public {
        compliance.updateDailyLimit(alice, 500e6);

        assertTrue(compliance.isCompliant(alice, bob, 500e6));
        assertFalse(compliance.isCompliant(alice, bob, 501e6));
    }

    function test_SetDefaultDailyLimit() public {
        compliance.setDefaultDailyLimit(5_000e6);

        assertTrue(compliance.isCompliant(alice, bob, 5_000e6));
        assertFalse(compliance.isCompliant(alice, bob, 5_001e6));
    }

    // ============ Minimum Amount ============

    function test_BelowMinimumRejected() public view {
        // Default minimum is 1 USDT (1e6)
        assertFalse(compliance.isCompliant(alice, bob, 0.5e6));
    }

    function test_ZeroAmountAllowed() public view {
        // Zero amount queries (like LP gating) should pass
        assertTrue(compliance.isCompliant(alice, bob, 0));
    }

    function test_SetMinimumAmount() public {
        compliance.setMinimumAmount(10e6);
        assertFalse(compliance.isCompliant(alice, bob, 9e6));
        assertTrue(compliance.isCompliant(alice, bob, 10e6));
    }

    // ============ Access Control ============

    function test_OnlyOwnerCanBlock() public {
        vm.prank(alice);
        vm.expectRevert();
        compliance.addToBlocklist(bob);
    }

    function test_OnlyHookCanRecordUsage() public {
        vm.prank(alice);
        vm.expectRevert(OpenCompliance.NotAuthorized.selector);
        compliance.recordUsage(alice, 100e6);
    }
}
