// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IWorldID } from "../../src/interfaces/IWorldID.sol";

/// @title MockWorldID
/// @notice Mock World ID contract for testing
/// @dev Always succeeds by default; can be configured to reject specific nullifiers
contract MockWorldID is IWorldID {
    /// @notice Set of nullifier hashes that should cause verification to fail
    mapping(uint256 => bool) public rejectNullifier;

    /// @notice If true, all verifications will fail
    bool public rejectAll;

    /// @notice Configure a nullifier hash to be rejected
    function setRejectNullifier(uint256 nullifierHash, bool reject) external {
        rejectNullifier[nullifierHash] = reject;
    }

    /// @notice Toggle rejection of all proofs
    function setRejectAll(bool reject) external {
        rejectAll = reject;
    }

    /// @inheritdoc IWorldID
    function verifyProof(
        uint256,
        uint256,
        uint256,
        uint256 nullifierHash,
        uint256,
        uint256[8] calldata
    ) external view override {
        require(!rejectAll, "MockWorldID: all proofs rejected");
        require(!rejectNullifier[nullifierHash], "MockWorldID: nullifier rejected");
    }
}
