// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { RemitTypes } from "../libraries/RemitTypes.sol";

/// @title IRemitSwapHook
/// @notice Interface for the RemitSwap Uniswap v4 hook
/// @author dev_jaytee
interface IRemitSwapHook {
    // ============ Remittance Management ============

    /// @notice Create a new remittance
    /// @param recipient Address to receive funds
    /// @param targetAmount Total amount to collect
    /// @param expiresAt Optional deadline (0 for no expiry)
    /// @param purposeHash IPFS hash or keccak256 of purpose description
    /// @param autoRelease Whether to auto-release when target is met
    /// @return remittanceId The ID of the created remittance
    function createRemittance(
        address recipient,
        uint256 targetAmount,
        uint256 expiresAt,
        bytes32 purposeHash,
        bool autoRelease
    ) external returns (uint256 remittanceId);

    /// @notice Create remittance using recipient's phone number
    /// @param recipientPhoneHash The keccak256 hash of recipient's phone number
    /// @param targetAmount Total amount to collect
    /// @param expiresAt Optional deadline
    /// @param purposeHash Purpose description hash
    /// @param autoRelease Whether to auto-release when target is met
    /// @return remittanceId The ID of the created remittance
    function createRemittanceByPhone(
        bytes32 recipientPhoneHash,
        uint256 targetAmount,
        uint256 expiresAt,
        bytes32 purposeHash,
        bool autoRelease
    ) external returns (uint256 remittanceId);

    /// @notice Contribute directly to a remittance without going through a swap
    /// @param remittanceId The remittance to contribute to
    /// @param amount The amount of supported token to contribute
    function contributeDirectly(uint256 remittanceId, uint256 amount) external;

    /// @notice Release funds to recipient (only recipient can call)
    /// @param remittanceId The remittance to release
    function releaseRemittance(uint256 remittanceId) external;

    /// @notice Cancel remittance and refund contributors (only creator)
    /// @param remittanceId The remittance to cancel
    function cancelRemittance(uint256 remittanceId) external;

    /// @notice Claim refund for an expired remittance (any contributor)
    /// @param remittanceId The expired remittance
    function claimExpiredRefund(uint256 remittanceId) external;

    // ============ View Functions ============

    /// @notice Get remittance details
    /// @param remittanceId The remittance ID
    /// @return The remittance view struct
    function getRemittance(uint256 remittanceId) external view returns (RemitTypes.RemittanceView memory);

    /// @notice Get contribution amount for a specific contributor
    /// @param remittanceId The remittance ID
    /// @param contributor The contributor address
    /// @return The contribution amount
    function getContribution(uint256 remittanceId, address contributor) external view returns (uint256);

    /// @notice Get all remittances created by an address
    /// @param creator The creator address
    /// @return Array of remittance IDs
    function getRemittancesByCreator(address creator) external view returns (uint256[] memory);

    /// @notice Get all remittances where address is recipient
    /// @param recipient The recipient address
    /// @return Array of remittance IDs
    function getRemittancesForRecipient(address recipient) external view returns (uint256[] memory);

    /// @notice Get the next remittance ID
    /// @return The next ID to be assigned
    function nextRemittanceId() external view returns (uint256);

    /// @notice Get the platform fee in basis points
    /// @return The fee in basis points (e.g., 50 = 0.5%)
    function platformFeeBps() external view returns (uint256);

    /// @notice Get the fee collector address
    /// @return The fee collector address
    function feeCollector() external view returns (address);

    /// @notice Check if global auto-release is enabled
    /// @return True if enabled
    function autoReleaseEnabled() external view returns (bool);

    // ============ Admin Functions ============

    /// @notice Update the compliance contract
    /// @param newCompliance The new compliance contract address
    function setCompliance(address newCompliance) external;

    /// @notice Update the phone resolver contract
    /// @param newResolver The new phone resolver address
    function setPhoneResolver(address newResolver) external;

    /// @notice Update the fee collector address
    /// @param newCollector The new fee collector address
    function setFeeCollector(address newCollector) external;

    /// @notice Update the platform fee
    /// @param newFeeBps The new fee in basis points
    function setPlatformFee(uint256 newFeeBps) external;

    /// @notice Toggle global auto-release setting
    /// @param enabled Whether auto-release should be enabled
    function setAutoRelease(bool enabled) external;

    /// @notice Set donation routing for a pool corridor
    /// @param pid The pool ID (bytes32)
    /// @param remittanceId The remittance to route donations to (0 to disable)
    function setDonationRouting(bytes32 pid, uint256 remittanceId) external;
}
