// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IWorldID
/// @notice Interface for the World ID identity verification protocol
/// @dev Based on the Worldcoin World ID on-chain verification interface
interface IWorldID {
    /// @notice Verify a World ID zero-knowledge proof
    /// @param root The Merkle root of the World ID identity set
    /// @param groupId The group ID (1 for Orb verification, 0 for Phone)
    /// @param signalHash The hash of the signal (typically the user's address)
    /// @param nullifierHash The nullifier hash to prevent double-signaling
    /// @param externalNullifierHash The external nullifier hash (app + action ID)
    /// @param proof The zero-knowledge proof array
    /// @dev Reverts if the proof is invalid
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}
