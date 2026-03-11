// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { HookTest, MockERC20 } from "./utils/HookTest.sol";
import { RemitHandler } from "./handlers/RemitHandler.sol";
import { RemitTypes } from "../src/libraries/RemitTypes.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title InvariantTest
/// @notice Invariant tests for AstraSendHook
/// @dev Uses a handler contract to perform random operations and verify invariants hold
contract InvariantTest is HookTest {
    RemitHandler public handler;

    function setUp() public override {
        super.setUp();

        // Create actor list (all must be on allowlist and have funds)
        address[] memory actors = new address[](4);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = charlie;
        actors[3] = recipient;

        handler = new RemitHandler(hook, IERC20(address(usdt)), actors);

        // Target only the handler for invariant calls
        targetContract(address(handler));
    }

    /// @notice Hook's token balance must always be >= sum of all active remittance currentAmounts
    /// @dev After contributions, the hook holds tokens. After release/cancel, they're distributed.
    function invariant_TotalContributionsMatchBalance() public view {
        uint256 hookBalance = usdt.balanceOf(address(hook));

        // Sum up all active remittance amounts
        uint256 totalActiveAmount = 0;
        uint256 nextId = hook.nextRemittanceId();

        for (uint256 i = 1; i < nextId; i++) {
            RemitTypes.RemittanceView memory remit = hook.getRemittance(i);
            if (remit.status == RemitTypes.Status.Active) {
                totalActiveAmount += remit.currentAmount;
            }
        }

        assertGe(hookBalance, totalActiveAmount, "Hook balance < sum of active remittance amounts");
    }

    /// @notice Released remittances must have Released status and cannot be modified
    function invariant_ReleasedRemittancesAreImmutable() public view {
        uint256 releasedCount = handler.getReleasedRemittanceCount();

        for (uint256 i = 0; i < releasedCount; i++) {
            uint256 remittanceId = handler.releasedRemittanceIds(i);
            RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
            assertEq(
                uint8(remit.status),
                uint8(RemitTypes.Status.Released),
                "Released remittance changed status"
            );
        }
    }

    /// @notice Cancelled remittances should have Cancelled status and zero contribution balances
    function invariant_CancelledRemittancesFullyRefunded() public view {
        uint256 cancelledCount = handler.getCancelledRemittanceCount();

        for (uint256 i = 0; i < cancelledCount; i++) {
            uint256 remittanceId = handler.cancelledRemittanceIds(i);
            RemitTypes.RemittanceView memory remit = hook.getRemittance(remittanceId);
            assertEq(
                uint8(remit.status),
                uint8(RemitTypes.Status.Cancelled),
                "Cancelled remittance changed status"
            );

            // All contributor balances should be zero after cancellation
            for (uint256 j = 0; j < remit.contributorList.length; j++) {
                assertEq(
                    hook.getContribution(remittanceId, remit.contributorList[j]),
                    0,
                    "Cancelled remittance has non-zero contribution"
                );
            }
        }
    }

    /// @notice Ghost variable accounting: total contributed >= total released + total refunded + remaining
    function invariant_GhostAccountingConsistent() public view {
        uint256 totalContributed = handler.ghost_totalContributed();
        uint256 totalReleased = handler.ghost_totalReleased();
        uint256 totalRefunded = handler.ghost_totalRefunded();
        uint256 totalFees = handler.ghost_totalFees();

        // What went in must equal what came out + what's still in the hook
        uint256 hookBalance = usdt.balanceOf(address(hook));
        assertEq(
            totalContributed,
            totalReleased + totalRefunded + totalFees + hookBalance,
            "Ghost accounting mismatch: in != out + held"
        );
    }
}
