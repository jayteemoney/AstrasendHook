// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { HookTest } from "./utils/HookTest.sol";
import { RemitTypes } from "../src/libraries/RemitTypes.sol";

/// @title IntegrationTest
/// @notice Full flow integration tests for AstraSendHook
contract IntegrationTest is HookTest {
    // ============ Full Remittance Flow Tests ============

    function test_FullFlow_SingleContributor() public {
        // 1. Create remittance
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // Verify creation
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.creator, alice);
        assertEq(remit.recipient, recipient);
        assertEq(remit.targetAmount, TARGET_AMOUNT);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Active));

        // 2. Bob contributes full amount
        uint256 bobBalanceBefore = _getBalance(bob);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // 3. Verify auto-release
        remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));

        // 4. Verify balances
        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        uint256 expectedRecipientAmount = TARGET_AMOUNT - expectedFee;

        assertEq(_getBalance(bob), bobBalanceBefore - TARGET_AMOUNT);
        assertEq(_getBalance(recipient), expectedRecipientAmount);
        assertEq(_getBalance(feeCollector), expectedFee);
    }

    function test_FullFlow_MultipleContributors() public {
        // 1. Create remittance for 1000 USDT
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // 2. Multiple contributors
        _contribute(bob, remittanceId, 300 * 1e6);
        _contribute(charlie, remittanceId, 400 * 1e6);

        // Verify partial funding
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, 700 * 1e6);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Active));

        // 3. Bob contributes more to meet target
        _contribute(bob, remittanceId, 300 * 1e6);

        // 4. Verify auto-release
        remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));

        // 5. Verify contributions tracked correctly
        assertEq(hook.getContribution(remittanceId, bob), 600 * 1e6);
        assertEq(hook.getContribution(remittanceId, charlie), 400 * 1e6);
    }

    function test_FullFlow_ManualRelease() public {
        // 1. Create remittance with auto-release disabled
        vm.prank(alice);
        uint256 remittanceId = hook.createRemittance(recipient, TARGET_AMOUNT, 0, bytes32(0), false);

        // 2. Contribute full amount
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // 3. Verify still active
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Active));

        // 4. Recipient manually releases
        uint256 recipientBalanceBefore = _getBalance(recipient);
        _release(recipient, remittanceId);

        // 5. Verify release
        remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));

        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        assertEq(_getBalance(recipient), recipientBalanceBefore + TARGET_AMOUNT - expectedFee);
    }

    function test_FullFlow_Cancellation() public {
        // 1. Create remittance
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // 2. Multiple contributors
        _contribute(bob, remittanceId, 300 * 1e6);
        _contribute(charlie, remittanceId, 200 * 1e6);

        uint256 bobBalanceBefore = _getBalance(bob);
        uint256 charlieBalanceBefore = _getBalance(charlie);

        // 3. Creator cancels
        _cancel(alice, remittanceId);

        // 4. Verify refunds
        assertEq(_getBalance(bob), bobBalanceBefore + 300 * 1e6);
        assertEq(_getBalance(charlie), charlieBalanceBefore + 200 * 1e6);

        // 5. Verify status
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Cancelled));
    }

    function test_FullFlow_ExpiredRefund() public {
        // 1. Create remittance with expiry
        uint256 expiresAt = block.timestamp + 7 days;
        uint256 remittanceId = _createRemittanceWithExpiry(alice, recipient, TARGET_AMOUNT, expiresAt);

        // 2. Partial contributions
        _contribute(bob, remittanceId, 300 * 1e6);
        _contribute(charlie, remittanceId, 200 * 1e6);

        // 3. Warp past expiry
        vm.warp(expiresAt + 1);

        // 4. Contributors claim refunds
        uint256 bobBalanceBefore = _getBalance(bob);
        uint256 charlieBalanceBefore = _getBalance(charlie);

        vm.prank(bob);
        hook.claimExpiredRefund(remittanceId);

        vm.prank(charlie);
        hook.claimExpiredRefund(remittanceId);

        // 5. Verify refunds
        assertEq(_getBalance(bob), bobBalanceBefore + 300 * 1e6);
        assertEq(_getBalance(charlie), charlieBalanceBefore + 200 * 1e6);

        // 6. Verify status
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Expired));
    }

    // ============ Phone-Based Remittance Tests ============

    function test_FullFlow_PhoneBasedRemittance() public {
        // 1. Register recipient phone
        string memory recipientPhone = "+254712345678";
        _registerPhone(recipientPhone, recipient);

        // 2. Create remittance by phone
        bytes32 phoneHash = _computePhoneHash(recipientPhone);

        vm.prank(alice);
        uint256 remittanceId = hook.createRemittanceByPhone(phoneHash, TARGET_AMOUNT, 0, bytes32(0), true);

        // 3. Verify recipient is resolved
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.recipient, recipient);

        // 4. Contribute and release
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // 5. Verify release
        remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }

    // ============ Compliance Integration Tests ============

    function test_Compliance_DailyLimitEnforced() public {
        // 1. Create remittance
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // 2. Contribute to use up daily limit
        _contribute(bob, remittanceId, DEFAULT_DAILY_LIMIT);

        // 3. Try to contribute more - should fail
        uint256 remittanceId2 = _createRemittance(alice, recipient, TARGET_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("ComplianceFailed()"));
        hook.contributeDirectly(remittanceId2, 1e6);

        // 4. Warp to next day
        vm.warp(block.timestamp + 1 days);

        // 5. Now should succeed
        _contribute(bob, remittanceId2, CONTRIBUTION_AMOUNT);

        assertEq(hook.getContribution(remittanceId2, bob), CONTRIBUTION_AMOUNT);
    }

    function test_Compliance_BlockedAddressCannotContribute() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // Block bob
        compliance.addToBlocklist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("ComplianceFailed()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
    }

    function test_Compliance_RemovedFromAllowlistCannotContribute() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // Remove bob from allowlist
        compliance.removeFromAllowlist(bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSignature("ComplianceFailed()"));
        hook.contributeDirectly(remittanceId, CONTRIBUTION_AMOUNT);
    }

    // ============ Edge Cases ============

    function test_EdgeCase_ExactTargetContribution() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        _contribute(bob, remittanceId, TARGET_AMOUNT);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, TARGET_AMOUNT);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }

    function test_EdgeCase_OverTargetContribution() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // Contribute more than target
        uint256 overAmount = TARGET_AMOUNT + 500 * 1e6;
        _contribute(bob, remittanceId, overAmount);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, overAmount);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));

        // Recipient gets full over-amount minus fee
        uint256 expectedFee = _calculateFee(overAmount);
        assertEq(_getBalance(recipient), overAmount - expectedFee);
    }

    function test_EdgeCase_MultipleRemittancesSameRecipient() public {
        // Create multiple remittances for same recipient
        uint256 id1 = _createRemittance(alice, recipient, TARGET_AMOUNT);
        uint256 id2 = _createRemittance(bob, recipient, TARGET_AMOUNT * 2);

        // Fund both
        _contribute(charlie, id1, TARGET_AMOUNT);
        _contribute(charlie, id2, TARGET_AMOUNT * 2);

        // Both should be released
        RemitTypes.RemittanceView memory remit1 = hook.getRemittance(id1);
        RemitTypes.RemittanceView memory remit2 = hook.getRemittance(id2);

        assertEq(uint8(remit1.status), uint8(RemitTypes.Status.Released));
        assertEq(uint8(remit2.status), uint8(RemitTypes.Status.Released));

        // Verify recipient remittances tracking
        uint256[] memory recipientRemittances = hook.getRemittancesForRecipient(recipient);
        assertEq(recipientRemittances.length, 2);
    }

    function test_EdgeCase_ContributorIsCreator() public {
        // Creator can also contribute to their own remittance
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        _contribute(alice, remittanceId, CONTRIBUTION_AMOUNT);

        assertEq(hook.getContribution(remittanceId, alice), CONTRIBUTION_AMOUNT);
    }

    // ============ Fee Calculation Tests ============

    function test_FeeCalculation_ZeroFee() public {
        // Set fee to 0
        hook.setPlatformFee(0);

        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Recipient gets full amount
        assertEq(_getBalance(recipient), TARGET_AMOUNT);
        assertEq(_getBalance(feeCollector), 0);
    }

    function test_FeeCalculation_MaxFee() public {
        // Set fee to max (5%)
        hook.setPlatformFee(500);

        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        uint256 expectedFee = (TARGET_AMOUNT * 500) / 10_000;
        assertEq(_getBalance(recipient), TARGET_AMOUNT - expectedFee);
        assertEq(_getBalance(feeCollector), expectedFee);
    }

    // ============ Stress Tests ============

    function test_Stress_ManyContributors() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT * 10);

        // Create and fund 10 contributors
        for (uint256 i = 0; i < 10; i++) {
            address contributor = makeAddr(string(abi.encodePacked("contributor", i)));
            usdt.mint(contributor, TARGET_AMOUNT);
            compliance.addToAllowlist(contributor, 0);

            vm.prank(contributor);
            usdt.approve(address(hook), TARGET_AMOUNT);

            _contribute(contributor, remittanceId, TARGET_AMOUNT);
        }

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(remit.currentAmount, TARGET_AMOUNT * 10);
        assertEq(remit.contributorList.length, 10);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }

    function test_Stress_ManyRemittances() public {
        // Create 20 remittances
        for (uint256 i = 0; i < 20; i++) {
            address recipientAddr = makeAddr(string(abi.encodePacked("recipient", i)));
            compliance.addToAllowlist(recipientAddr, 0);

            _createRemittance(alice, recipientAddr, CONTRIBUTION_AMOUNT);
        }

        uint256[] memory aliceRemittances = hook.getRemittancesByCreator(alice);
        assertEq(aliceRemittances.length, 20);
    }

    // ============ State Consistency Tests ============

    function test_StateConsistency_AfterRelease() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);

        // State should be consistent after release
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
        assertEq(remit.currentAmount, TARGET_AMOUNT);
        assertEq(remit.contributorList.length, 1);
        assertEq(remit.contributorList[0], bob);
    }

    function test_StateConsistency_AfterCancel() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, 300 * 1e6);
        _contribute(charlie, remittanceId, 200 * 1e6);

        _cancel(alice, remittanceId);

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);

        // Contributions should be reset after refund
        assertEq(hook.getContribution(remittanceId, bob), 0);
        assertEq(hook.getContribution(remittanceId, charlie), 0);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Cancelled));
    }

    // ============ Admin Operations in Full Flow ============

    function test_AdminOps_ChangeFeeCollectorMidFlow() public {
        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);

        // Change fee collector
        address newFeeCollector = makeAddr("newFeeCollector");
        hook.setFeeCollector(newFeeCollector);

        // Complete remittance
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Fee should go to new collector
        uint256 expectedFee = _calculateFee(TARGET_AMOUNT);
        assertEq(_getBalance(newFeeCollector), expectedFee);
        assertEq(_getBalance(feeCollector), 0);
    }

    function test_AdminOps_DisableAutoRelease() public {
        hook.setAutoRelease(false);

        uint256 remittanceId = _createRemittance(alice, recipient, TARGET_AMOUNT);
        _contribute(bob, remittanceId, TARGET_AMOUNT);

        // Should still be active even though target met
        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Active));

        // Recipient can still release manually
        _release(recipient, remittanceId);
        remit = hook.getRemittance(remittanceId);
        assertEq(uint8(remit.status), uint8(RemitTypes.Status.Released));
    }
}
