// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title RemitTypes
/// @notice Shared types, structs, and events for the RemitSwap system
/// @author dev_jaytee
library RemitTypes {
    /// @notice Status of a remittance
    enum Status {
        Active, // Accepting contributions
        Released, // Funds sent to recipient
        Cancelled, // Creator cancelled, contributors refunded
        Expired // Past deadline, can be claimed or refunded
    }

    /// @notice Individual contribution record
    struct Contribution {
        address contributor;
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice Main remittance structure (storage-friendly version without mapping)
    /// @dev Actual storage uses RemittanceStorage which includes mapping
    struct RemittanceView {
        uint256 id;
        address creator;
        address recipient;
        address token;
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 platformFeeBps;
        uint256 createdAt;
        uint256 expiresAt;
        bytes32 purposeHash;
        Status status;
        bool autoRelease;
        address[] contributorList;
    }

    /// @notice Hook data passed through swaps
    struct RemitHookData {
        uint256 remittanceId;
        bool isContribution;
    }

    /// @notice Events
    event RemittanceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        uint256 targetAmount,
        uint256 expiresAt,
        bool autoRelease
    );

    event ContributionMade(
        uint256 indexed remittanceId, address indexed contributor, uint256 amount, uint256 newTotal
    );

    event RemittanceReleased(uint256 indexed remittanceId, address indexed recipient, uint256 amount, uint256 fee);

    event RemittanceCancelled(uint256 indexed remittanceId, address indexed creator, uint256 refundedAmount);

    event RemittanceExpired(uint256 indexed remittanceId, uint256 totalAmount);

    event ComplianceContractUpdated(address indexed oldCompliance, address indexed newCompliance);

    event PhoneResolverUpdated(address indexed oldResolver, address indexed newResolver);

    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);

    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    event AutoReleaseToggled(bool enabled);

    event PoolRegistered(bytes32 indexed poolId, address token0, address token1, uint24 fee);

    event DonationRouted(
        uint256 indexed remittanceId, address indexed donor, uint256 amount0, uint256 amount1
    );

    event ComplianceGatedLP(address indexed provider, bytes32 indexed poolId, bool allowed);
}
