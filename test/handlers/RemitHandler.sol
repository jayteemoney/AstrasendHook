// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Test } from "forge-std/Test.sol";
import { AstraSendHook } from "../../src/AstraSendHook.sol";
import { RemitTypes } from "../../src/libraries/RemitTypes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RemitHandler
/// @notice Handler contract for invariant testing of AstraSendHook
/// @dev Performs random operations (create, contribute, release, cancel, claim) on the hook
contract RemitHandler is Test {
    AstraSendHook public hook;
    IERC20 public usdt;

    address[] public actors;
    uint256[] public activeRemittanceIds;
    uint256[] public releasedRemittanceIds;
    uint256[] public cancelledRemittanceIds;

    // Ghost variables for tracking state
    uint256 public ghost_totalContributed;
    uint256 public ghost_totalReleased;
    uint256 public ghost_totalRefunded;
    uint256 public ghost_totalFees;

    constructor(AstraSendHook _hook, IERC20 _usdt, address[] memory _actors) {
        hook = _hook;
        usdt = _usdt;
        actors = _actors;
    }

    // ============ Handler Actions ============

    /// @notice Create a new remittance
    function createRemittance(uint256 actorSeed, uint256 recipientSeed, uint256 targetAmount) external {
        address creator = _getActor(actorSeed);
        address recipient = _getRecipient(recipientSeed, creator);
        targetAmount = bound(targetAmount, 1e6, 5_000 * 1e6); // 1 - 5000 USDT

        vm.prank(creator);
        try hook.createRemittance(recipient, targetAmount, 0, bytes32(0), false) returns (uint256 id) {
            activeRemittanceIds.push(id);
        } catch {}
    }

    /// @notice Contribute to an active remittance
    function contribute(uint256 actorSeed, uint256 remittanceIdSeed, uint256 amount) external {
        if (activeRemittanceIds.length == 0) return;

        address contributor = _getActor(actorSeed);
        uint256 remittanceId = activeRemittanceIds[remittanceIdSeed % activeRemittanceIds.length];
        amount = bound(amount, 1e6, 1_000 * 1e6); // 1 - 1000 USDT

        // Mint tokens and approve
        deal(address(usdt), contributor, amount);
        vm.prank(contributor);
        usdt.approve(address(hook), amount);

        vm.prank(contributor);
        try hook.contributeDirectly(remittanceId, amount) {
            ghost_totalContributed += amount;
        } catch {}
    }

    /// @notice Release an active remittance that has met its target
    function release(uint256 remittanceIdSeed) external {
        if (activeRemittanceIds.length == 0) return;

        uint256 idx = remittanceIdSeed % activeRemittanceIds.length;
        uint256 remittanceId = activeRemittanceIds[idx];

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        if (remit.status != RemitTypes.Status.Active) return;
        if (remit.currentAmount < remit.targetAmount) return;

        uint256 fee = (remit.currentAmount * remit.platformFeeBps) / 10_000;

        vm.prank(remit.recipient);
        try hook.releaseRemittance(remittanceId) {
            ghost_totalReleased += remit.currentAmount - fee;
            ghost_totalFees += fee;
            releasedRemittanceIds.push(remittanceId);
            _removeActiveRemittance(idx);
        } catch {}
    }

    /// @notice Cancel an active remittance
    function cancel(uint256 remittanceIdSeed) external {
        if (activeRemittanceIds.length == 0) return;

        uint256 idx = remittanceIdSeed % activeRemittanceIds.length;
        uint256 remittanceId = activeRemittanceIds[idx];

        RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
        if (remit.status != RemitTypes.Status.Active) return;

        vm.prank(remit.creator);
        try hook.cancelRemittance(remittanceId) {
            ghost_totalRefunded += remit.currentAmount;
            cancelledRemittanceIds.push(remittanceId);
            _removeActiveRemittance(idx);
        } catch {}
    }

    // ============ View Helpers ============

    function getActiveRemittanceCount() external view returns (uint256) {
        return activeRemittanceIds.length;
    }

    function getReleasedRemittanceCount() external view returns (uint256) {
        return releasedRemittanceIds.length;
    }

    function getCancelledRemittanceCount() external view returns (uint256) {
        return cancelledRemittanceIds.length;
    }

    // ============ Internal Helpers ============

    function _getActor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _getRecipient(uint256 seed, address creator) internal view returns (address) {
        address candidate = actors[seed % actors.length];
        // Avoid self-remittance
        if (candidate == creator) {
            candidate = actors[(seed + 1) % actors.length];
        }
        return candidate;
    }

    function _removeActiveRemittance(uint256 idx) internal {
        activeRemittanceIds[idx] = activeRemittanceIds[activeRemittanceIds.length - 1];
        activeRemittanceIds.pop();
    }
}
