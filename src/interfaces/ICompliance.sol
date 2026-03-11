// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ICompliance
/// @notice Interface for compliance modules in the AstraSend system
/// @author dev_jaytee
interface ICompliance {
    /// @notice Check if a transfer is compliant
    /// @param sender The address sending funds
    /// @param recipient The address receiving funds
    /// @param amount The amount being transferred
    /// @return True if compliant
    function isCompliant(address sender, address recipient, uint256 amount) external view returns (bool);

    /// @notice Get compliance status details for an account
    /// @param account The address to check
    /// @return isAllowed Whether account is on allowlist
    /// @return dailyUsed Amount used today
    /// @return dailyLimit Daily limit for account
    function getComplianceStatus(address account)
        external
        view
        returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit);

    /// @notice Record usage after a successful contribution (called by hook)
    /// @param sender The address that made the contribution
    /// @param amount The amount contributed
    function recordUsage(address sender, uint256 amount) external;

    /// @notice Check if an address is blocked
    /// @param account The address to check
    /// @return True if blocked
    function isBlocked(address account) external view returns (bool);

    /// @notice Get the remaining daily limit for an address
    /// @param account The address to check
    /// @return The remaining amount that can be sent today
    function getRemainingDailyLimit(address account) external view returns (uint256);
}
