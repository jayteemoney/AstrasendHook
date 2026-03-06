// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { HookTest } from "./utils/HookTest.sol";
import { RemitTypes } from "../src/libraries/RemitTypes.sol";
import { Hooks } from "v4-core/src/libraries/Hooks.sol";
import { AllowlistCompliance } from "../src/compliance/AllowlistCompliance.sol";

/// @title RemitSwapHookTest
/// @notice Tests for the RemitSwapHook contract
contract RemitSwapHookTest is HookTest {
    // ============ Setup Tests ============

    function test_HookDeployment() public view {
        assertEq(address(hook.compliance()), address(compliance));
        assertEq(address(hook.phoneResolver()), address(phoneResolver));
        assertEq(hook.feeCollector(), feeCollector);
        assertEq(hook.platformFeeBps(), PLATFORM_FEE_BPS);
        assertEq(hook.nextRemittanceId(), 1);
        assertTrue(hook.autoReleaseEnabled());
    }

    function test_HookPermissions() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();

        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertTrue(permissions.afterSwapReturnDelta);
        assertTrue(permissions.afterInitialize);
        assertTrue(permissions.beforeAddLiquidity);
        assertTrue(permissions.beforeDonate);
        assertFalse(permissions.beforeInitialize);
        assertFalse(permissions.afterAddLiquidity);
        assertFalse(permissions.beforeRemoveLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertFalse(permissions.afterDonate);
        assertFalse(permissions.beforeSwapReturnDelta);
    }

    // ============ Remittance Creation Tests ============

    function test_CreateRemittance_Success() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        assertEq(remittanceId, 1);
        assertEq(hook.nextRemittanceId(), 2);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.id, remittanceId);
        assertEq(remit.creator, alice);
        assertEq(remit.recipient, recipient);
        assertEq(remit.targetAmount, TARGET_AMOUNT);
        assertEq(remit.currentAmount, 0);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Active));
        assertTrue(remit.autoRelease);
    }

    function test_CreateRemittance_MultipleRemittances() public {
        uint256 id1 = _createRemittance(alice, recipient, TARGET_AMOUNT);
        uint256 id2 = _createRemittance(bob, recipient, TARGET_AMOUNT * 2);
        uint256 id3 = _createRemittance(alice, bob, TARGET_AMOUNT / 2);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);

        uint256[] memory aliceRemittances = hook.getRemittancesByCreator(alice);
        assertEq(aliceRemittances.length, 2);
        assertEq(aliceRemittances[0], 1);
        assertEq(aliceRemittances[1], 3);

        uint256[] memory recipientRemittances = hook.getRemittancesForRecipient(recipient);
        assertEq(recipientRemittances.length, 2);
    }

    function test_CreateRemittance_WithExpiry() public {
        uint256 expiresAt = block.timestamp + 7 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.expiresAt, expiresAt);
    }

    function test_CreateRemittance_RevertIfZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("InvalidRecipient()"));
        hook.createRemittance(address(0), TARGET_AMOUNT, 0, bytes32(0), true);
    }

    function test_CreateRemittance_RevertIfZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        hook.createRemittance(recipient, 0, 0, bytes32(0), true);
    }

    function test_CreateRemittance_RevertIfSelfRecipient() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("SelfRemittance()"));
        hook.createRemittance(alice, TARGET_AMOUNT, 0, bytes32(0), true);
    }

    function test_CreateRemittance_RevertIfPastExpiry() public {
        // Warp to a later time to ensure we have a valid past timestamp
        vm.warp(1000);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("InvalidExpiry()"));
        hook.createRemittance(recipient, TARGET_AMOUNT, block.timestamp - 1, bytes32(0), true);
    }

    function test_CreateRemittance_RevertIfNotCompliant() public {
        address notAllowed = makeAddr("notAllowed");

        vm.prank(notAllowed);
        vm.expectRevert(abi.encodeWithSignature("ComplianceFailed()"));
        hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), true);
    }

    // ============ Direct Contribution Tests ============

    function test_ContributeDirectly_Success() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        uint256 bobBalanceBefore = _getBalance(bob);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        uint256 bobBalanceAfter = _getBalance(bob);

        assertEq(bobBalanceBefore - bobBalanceAfter, CONTRIBUTION_AMOUNT);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, CONTRIBUTION_AMOUNT);
        assertEq(remit.contributorList.length, 1);
        assertEq(remit.contributorList[0], bob);

        uint256 contribution = hook.getContribution(remittanceId, bob);
        assertEq(contribution, CONTRIBUTION_AMOUNT);
    }

    function test_ContributeDirectly_MultipleContributions() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        _contribute(charlie, remittanceId, CONTRIBUTION_AMOUNT * 2);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT); // Bob contributes again

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, CONTRIBUTION_AMOUNT * 4);
        assertEq(remit.contributorList.length, 2); // Bob and Charlie

        assertEq(hook.getContribution(remittanceId, bob), CONTRIBUTION_AMOUNT * 2);
        assertEq(hook.getContribution(remittanceId, charlie), CONTRIBUTION_AMOUNT * 2);
    }

    function test_ContributeDirectly_AutoReleaseWhenTargetMet() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        uint256 recipientBalanceBefore = _getBalance(recipient);

        // Contribute exactly the target amount
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        uint256 recipientBalanceAfter = _getBalance(recipient);
        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        uint256 expectedAmount = TARGET_AMOUNT - expectedFee;

        assertEq(recipientBalanceAfter - recipientBalanceBefore, expectedAmount);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }

    function test_ContributeDirectly_RevertIfRemittanceNotFound() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotFound()"));
        hook.contributeDirectly(999, CONTRIBUTION_AMOUNT);
    }

    function test_ContributeDirectly_RevertIfNotCompliant() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        address notAllowed = makeAddr("notAllowed");
        usdt.mint(notAllowed, CONTRIBUTION_AMOUNT);

        vm.startPrank(notAllowed);
        usdt.approve(address(hook), CONTRIBUTION_AMOUNT);
        vm.expectRevert(abi.encodeWithSignature("ComplianceFailed()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
        vm.stopPrank();
    }

    function test_ContributeDirectly_RevertIfRecipientContributes() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        usdt.mint(recipient, CONTRIBUTION_AMOUNT);
        vm.startPrank(recipient);
        usdt.approve(address(hook), CONTRIBUTION_AMOUNT);
        vm.expectRevert(abi.encodeWithSignature("RecipientCannotContribute()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
        vm.stopPrank();
    }

    function test_ContributeDirectly_RevertIfExpired() public {
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);

        // Warp past expiry
        vm.warp(expiresAt + 1);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("RemittanceExpired()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
    }

    // ============ Release Tests ============

    function test_Release_Success() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Since auto-release is enabled, it should already be released
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }

    function test_Release_ManualRelease() public {
        // Create remittance with auto-release disabled
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);

        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Should still be active
        RemitTypes.RemittanceView memory remitBefore = hook.getRemittance(remittanceId);
        assertEq(uint8(remitBefore.status), uint8(RemitTypes.Status.Active));

        // Recipient releases manually
        uint256 recipientBalanceBefore = _getBalance(recipient);
        uint256 feeCollectorBalanceBefore = _getBalance(feeCollector);

        _release(recipient, remittanceId);

        uint256 recipientBalanceAfter = _getBalance(recipient);
        uint256 feeCollectorBalanceAfter = _getBalance(feeCollector);

        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        assertEq(recipientBalanceAfter - recipientBalanceBefore, TARGET_AMOUNT - expectedFee);
        assertEq(feeCollectorBalanceAfter - feeCollectorBalanceBefore, expectedFee);

        RemitTypes.RemittanceView memory remitAfter = hook.getRemittance(remittanceId);
        assertEq(uint8(remitAfter.status), uint8(RemitTypes.Status.Released));
    }

    function test_Release_RevertIfNotRecipient() public {
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OnlyRecipient()"));
        hook.releaseRemittance(remittanceId);
    }

    function test_Release_RevertIfTargetNotMet() public {
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT / 2);

        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSignature("TargetNotMet()"));
        hook.releaseRemittance(remittanceId);
    }

    // ============ Cancellation Tests ============

    function test_Cancel_Success() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        _contribute(charlie, remittanceId, CONTRIBUTION_AMOUNT * 2);

        uint256 bobBalanceBefore = _getBalance(bob);
        uint256 charlieBalanceBefore = _getBalance(charlie);

        _cancel(alice, remittanceId);

        uint256 bobBalanceAfter = _getBalance(bob);
        uint256 charlieBalanceAfter = _getBalance(charlie);

        // Check refunds
        assertEq(bobBalanceAfter - bobBalanceBefore, CONTRIBUTION_AMOUNT);
        assertEq(charlieBalanceAfter - charlieBalanceBefore, CONTRIBUTION_AMOUNT * 2);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Cancelled));
    }

    function test_Cancel_RevertIfNotCreator() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("OnlyCreator()"));
        hook.cancelRemittance(remittanceId);
    }

    function test_Cancel_RevertIfAlreadyReleased() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Already auto-released
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotActive()"));
        hook.cancelRemittance(remittanceId);
    }

    // ============ Expired Refund Tests ============

    function test_ClaimExpiredRefund_Success() public {
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);

        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);

        // Warp past expiry
        vm.warp(expiresAt + 1);

        uint256 bobBalanceBefore = _getBalance(bob);

        vm.prank(bob);
        hook.claimExpiredRefund(remittanceId);

        uint256 bobBalanceAfter = _getBalance(bob);
        assertEq(bobBalanceAfter - bobBalanceBefore, CONTRIBUTION_AMOUNT);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Expired));
    }

    function test_ClaimExpiredRefund_RevertIfNotExpired() public {
        uint256 expiresAt = block.timestamp + 1 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotExpired()"));
        hook.claimExpiredRefund(remittanceId);
    }

    // ============ Admin Function Tests ============

    function test_SetCompliance() public {
        AllowlistCompliance newCompliance = new AllowlistCompliance();

        hook.setCompliance(address(newCompliance));
        assertEq(address(hook.compliance()), address(newCompliance));
    }

    function test_SetFeeCollector() public {
        address newCollector = makeAddr("newCollector");

        hook.setFeeCollector(newCollector);
        assertEq(hook.feeCollector(), newCollector);
    }

    function test_SetPlatformFee() public {
        hook.setPlatformFee(100); // 1%
        assertEq(hook.platformFeeBps(), 100);
    }

    function test_SetPlatformFee_RevertIfTooHigh() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidFee()"));
        hook.setPlatformFee(501); // > 5%
    }

    function test_SetAutoRelease() public {
        hook.setAutoRelease(false);
        assertFalse(hook.autoReleaseEnabled());

        hook.setAutoRelease(true);
        assertTrue(hook.autoReleaseEnabled());
    }

    // ============ Additional Error Case Tests ============

    function test_ContributeDirectly_RevertIfRemittanceCancelled() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);

        // Cancel
        _cancel(alice, remittanceId);

        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotActive()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
    }

    function test_ContributeDirectly_RevertIfRemittanceReleased() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT); // Auto-releases

        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotActive()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
    }

    function test_ContributeDirectly_RevertIfZeroAmount() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        hook.contributeDirectly(remittanceId, 0);
    }

    function test_ContributeDirectly_UpdatesBalance() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        assertEq(hook.getContribution(remittanceId, bob), CONTRIBUTION_AMOUNT);

        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        assertEq(hook.getContribution(remittanceId, bob), CONTRIBUTION_AMOUNT * 2);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, CONTRIBUTION_AMOUNT * 2);
    }

    function test_ContributeDirectly_TracksContributorList() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        _contribute(charlie, remittanceId, CONTRIBUTION_AMOUNT);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT); // second contribution, should not add again

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.contributorList.length, 2);
        assertEq(remit.contributorList[0], bob);
        assertEq(remit.contributorList[1], charlie);
    }

    function test_Release_RevertIfAlreadyReleased() public {
        // Create with auto-release disabled for manual release
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        _release(recipient, remittanceId);

        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSignature("RemittanceNotActive()"));
        hook.releaseRemittance(remittanceId);
    }

    function test_Release_CalculatesFeeCorrectly() public {
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        uint256 recipientBefore = _getBalance(recipient);
        uint256 feeBefore = _getBalance(feeCollector);

        _release(recipient, remittanceId);

        uint256 expectedFee = (TARGET_AMOUNT * PLATFORM_FEE_BPS) / 10_000;
        uint256 expectedRecipient = TARGET_AMOUNT - expectedFee;

        assertEq(_getBalance(recipient) - recipientBefore, expectedRecipient);
        assertEq(_getBalance(feeCollector) - feeBefore, expectedFee);
        assertEq(expectedFee, 5 * 1e6); // 0.5% of 1000 USDT = 5 USDT
    }

    function test_Release_TransfersToRecipient() public {
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        uint256 recipientBefore = _getBalance(recipient);
        _release(recipient, remittanceId);

        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        assertEq(_getBalance(recipient) - recipientBefore, TARGET_AMOUNT - expectedFee);
    }

    function test_Release_TransfersFeeToCollector() public {
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        uint256 feeBefore = _getBalance(feeCollector);
        _release(recipient, remittanceId);

        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        assertEq(_getBalance(feeCollector) - feeBefore, expectedFee);
    }

    function test_Cancel_RefundsAllContributors() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, CONTRIBUTION_AMOUNT);
        _contribute(charlie, remittanceId, CONTRIBUTION_AMOUNT * 2);

        uint256 bobBefore = _getBalance(bob);
        uint256 charlieBefore = _getBalance(charlie);

        _cancel(alice, remittanceId);

        assertEq(_getBalance(bob) - bobBefore, CONTRIBUTION_AMOUNT);
        assertEq(_getBalance(charlie) - charlieBefore, CONTRIBUTION_AMOUNT * 2);

        // Contributions should be zeroed out
        assertEq(hook.getContribution(remittanceId, bob), 0);
        assertEq(hook.getContribution(remittanceId, charlie), 0);
    }

    function test_Cancel_RefundsCorrectAmounts() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        uint256 amount1 = 50 * 1e6;
        uint256 amount2 = 150 * 1e6;
        uint256 amount3 = 75 * 1e6;

        _contribute(bob, remittanceId, amount1);
        _contribute(charlie, remittanceId, amount2);
        _contribute(bob, remittanceId, amount3); // Bob contributes again

        uint256 bobBefore = _getBalance(bob);
        uint256 charlieBefore = _getBalance(charlie);

        _cancel(alice, remittanceId);

        // Bob should get amount1 + amount3 back
        assertEq(_getBalance(bob) - bobBefore, amount1 + amount3);
        // Charlie should get amount2 back
        assertEq(_getBalance(charlie) - charlieBefore, amount2);
    }

    // ============ Fuzz Tests ============

    function testFuzz_MultipleContributions(uint8 numContributions) public {
        numContributions = uint8(bound(numContributions, 1, 10));

        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, DEFAULT_DAILY_LIMIT, 0, bytes32(0), false);

        uint256 totalContributed = 0;
        uint256 perContribution = 100 * 1e6; // 100 USDT each

        for (uint8 i = 0; i < numContributions; i++) {
            _contribute(bob, remittanceId, perContribution);
            totalContributed += perContribution;
        }

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, totalContributed);
        assertEq(hook.getContribution(remittanceId, bob), totalContributed);
        assertEq(remit.contributorList.length, 1); // same contributor
    }

    function testFuzz_Contribute(uint256 amount) public {
        // Bound amount to reasonable range (within daily limit)
        amount = bound(amount, 1e6, DEFAULT_DAILY_LIMIT);

        // Use a target amount within daily limit for compliance
        uint256 remittanceId = _createRemittance(alice, recipient, DEFAULT_DAILY_LIMIT);

        usdt.mint(bob, amount);

        _contribute(bob, remittanceId, amount);

        assertEq(hook.getContribution(remittanceId, bob), amount);
    }

    // ============ New Hook Tests ============

    function test_MaxContributors() public {
        // Use a target within daily limit; give alice a high custom limit for creation
        compliance.updateDailyLimit(alice, 10_000 * 1e6);
        uint256 remittanceId = _createRemittance(alice, recipient, 5_000 * 1e6);

        // Add MAX_CONTRIBUTORS unique contributors
        for (uint256 i = 0; i < hook.MAX_CONTRIBUTORS(); i++) {
            address contributor = makeAddr(string(abi.encodePacked("contributor", i)));
            usdt.mint(contributor, 2 * 1e6);
            compliance.addToAllowlist(contributor, 0);
            vm.startPrank(contributor);
            usdt.approve(address(hook), 2 * 1e6);
            hook.contributeDirectly(remittanceId, 2 * 1e6);
            vm.stopPrank();
        }

        // The 51st unique contributor should revert
        address extraContributor = makeAddr("extra");
        usdt.mint(extraContributor, 2 * 1e6);
        compliance.addToAllowlist(extraContributor, 0);
        vm.startPrank(extraContributor);
        usdt.approve(address(hook), 2 * 1e6);
        vm.expectRevert(abi.encodeWithSignature("MaxContributorsReached()"));
        hook.contributeDirectly(remittanceId, 2 * 1e6);
        vm.stopPrank();
    }

    function test_MaxContributors_ExistingContributorCanStillContribute() public {
        compliance.updateDailyLimit(alice, 10_000 * 1e6);
        uint256 remittanceId = _createRemittance(alice, recipient, 5_000 * 1e6);

        // Fill up to MAX_CONTRIBUTORS
        for (uint256 i = 0; i < hook.MAX_CONTRIBUTORS(); i++) {
            address contributor = makeAddr(string(abi.encodePacked("contributor", i)));
            usdt.mint(contributor, 10 * 1e6);
            compliance.addToAllowlist(contributor, 0);
            vm.startPrank(contributor);
            usdt.approve(address(hook), type(uint256).max);
            hook.contributeDirectly(remittanceId, 2 * 1e6);
            vm.stopPrank();
        }

        // Existing contributor (first one) should still be able to contribute again
        address firstContributor = makeAddr(string(abi.encodePacked("contributor", uint256(0))));
        vm.prank(firstContributor);
        hook.contributeDirectly(remittanceId, 2 * 1e6);

        assertEq(hook.getContribution(remittanceId, firstContributor), 4 * 1e6);
    }

    function test_SetDonationRouting() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes32 pid = bytes32(uint256(1));

        hook.setDonationRouting(pid, remittanceId);
        assertEq(hook.donationRouting(pid), remittanceId);
    }

    function test_SetDonationRouting_RevertIfRemittanceNotFound() public {
        bytes32 pid = bytes32(uint256(1));

        vm.expectRevert(abi.encodeWithSignature("RemittanceNotFound()"));
        hook.setDonationRouting(pid, 999);
    }

    function test_SetDonationRouting_ClearRouting() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        bytes32 pid = bytes32(uint256(1));

        hook.setDonationRouting(pid, remittanceId);
        assertEq(hook.donationRouting(pid), remittanceId);

        // Clear routing
        hook.setDonationRouting(pid, 0);
        assertEq(hook.donationRouting(pid), 0);
    }

    function test_RegisteredPools_InitiallyFalse() public view {
        bytes32 pid = bytes32(uint256(1));
        assertFalse(hook.registeredPools(pid));
    }

    // ============ Fuzz Tests ============

    function testFuzz_FeeCalculation(uint256 amount, uint256 feeBps) public {
        // Bound amount to within daily limit to pass compliance
        amount = bound(amount, 1e6, DEFAULT_DAILY_LIMIT);
        feeBps = bound(feeBps, 0, 500);

        hook.setPlatformFee(feeBps);

        uint256 expectedFee = (amount * feeBps) / 10_000;
        uint256 expectedRecipient = amount - expectedFee;

        // Create remittance with disabled auto-release
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, amount, 0, bytes32(0), false);

        usdt.mint(bob, amount);
        _contribute(bob, remittanceId, amount);

        uint256 recipientBalanceBefore = _getBalance(recipient);
        uint256 feeCollectorBalanceBefore = _getBalance(feeCollector);

        _release(recipient, remittanceId);

        uint256 recipientBalanceAfter = _getBalance(recipient);
        uint256 feeCollectorBalanceAfter = _getBalance(feeCollector);

        assertEq(recipientBalanceAfter - recipientBalanceBefore, expectedRecipient);
        assertEq(feeCollectorBalanceAfter - feeCollectorBalanceBefore, expectedFee);
    }
}
