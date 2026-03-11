// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ICompliance } from "../interfaces/ICompliance.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AllowlistCompliance
/// @notice Phase 1 compliance using allowlist and daily limits.
///         Owner controls critical settings. Admins handle allowlist/blocklist operations.
/// @author dev_jaytee
contract AllowlistCompliance is ICompliance, Ownable {
    // ============ State Variables ============

    /// @notice The hook contract that can record usage
    address public hook;

    /// @notice Addresses granted admin rights (allowlist/blocklist operators)
    mapping(address => bool) public admins;

    /// @notice Allowlist of verified addresses
    mapping(address => bool) public allowlist;

    /// @notice Blocked addresses (sanctions list)
    mapping(address => bool) public blocklist;

    /// @notice Custom daily limits per address (0 means use default)
    mapping(address => uint256) public customDailyLimits;

    /// @notice Daily usage tracking: address => day => amount used
    mapping(address => mapping(uint256 => uint256)) public dailyUsage;

    /// @notice Default daily limit (10,000 USDT with 6 decimals)
    uint256 public defaultDailyLimit = 10_000 * 1e6;

    /// @notice Minimum transfer amount (1 USDT)
    uint256 public minimumAmount = 1e6;

    // ============ Events ============

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event AddedToAllowlist(address indexed account, uint256 customLimit);
    event RemovedFromAllowlist(address indexed account);
    event AddedToBlocklist(address indexed account);
    event RemovedFromBlocklist(address indexed account);
    event DailyLimitUpdated(address indexed account, uint256 newLimit);
    event DefaultDailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MinimumAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event HookUpdated(address indexed oldHook, address indexed newHook);

    // ============ Errors ============

    error NotAuthorized();
    error InvalidAddress();
    error InvalidAmount();
    error AlreadyOnAllowlist();
    error NotOnAllowlist();
    error AlreadyBlocked();
    error NotBlocked();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) { }

    // ============ Modifiers ============

    modifier onlyHook() {
        if (msg.sender != hook) revert NotAuthorized();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != owner() && !admins[msg.sender]) revert NotAuthorized();
        _;
    }

    // ============ Owner Functions — Critical Settings ============

    /// @notice Set the hook contract address
    function setHook(address _hook) external onlyOwner {
        if (_hook == address(0)) revert InvalidAddress();
        emit HookUpdated(hook, _hook);
        hook = _hook;
    }

    /// @notice Grant admin rights to an address
    function addAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert InvalidAddress();
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    /// @notice Revoke admin rights from an address
    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    /// @notice Update default daily limit
    function setDefaultDailyLimit(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert InvalidAmount();
        emit DefaultDailyLimitUpdated(defaultDailyLimit, newLimit);
        defaultDailyLimit = newLimit;
    }

    /// @notice Update minimum amount
    function setMinimumAmount(uint256 newMinimum) external onlyOwner {
        emit MinimumAmountUpdated(minimumAmount, newMinimum);
        minimumAmount = newMinimum;
    }

    /// @notice Update daily limit for a specific address
    function updateDailyLimit(address account, uint256 newLimit) external onlyOwner {
        customDailyLimits[account] = newLimit;
        emit DailyLimitUpdated(account, newLimit);
    }

    // ============ Admin Functions — Operational ============

    /// @notice Add address to allowlist with optional custom limit
    function addToAllowlist(address account, uint256 customLimit) external onlyAdmin {
        if (account == address(0)) revert InvalidAddress();
        if (allowlist[account]) revert AlreadyOnAllowlist();

        allowlist[account] = true;
        if (customLimit > 0) {
            customDailyLimits[account] = customLimit;
        }

        emit AddedToAllowlist(account, customLimit);
    }

    /// @notice Batch add addresses to allowlist
    function batchAddToAllowlist(address[] calldata accounts, uint256[] calldata customLimits) external onlyAdmin {
        if (accounts.length != customLimits.length) revert InvalidAmount();

        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0) && !allowlist[accounts[i]]) {
                allowlist[accounts[i]] = true;
                if (customLimits[i] > 0) {
                    customDailyLimits[accounts[i]] = customLimits[i];
                }
                emit AddedToAllowlist(accounts[i], customLimits[i]);
            }
        }
    }

    /// @notice Remove address from allowlist
    function removeFromAllowlist(address account) external onlyAdmin {
        if (!allowlist[account]) revert NotOnAllowlist();
        allowlist[account] = false;
        delete customDailyLimits[account];
        emit RemovedFromAllowlist(account);
    }

    /// @notice Add address to blocklist
    function addToBlocklist(address account) external onlyAdmin {
        if (account == address(0)) revert InvalidAddress();
        if (blocklist[account]) revert AlreadyBlocked();
        blocklist[account] = true;
        emit AddedToBlocklist(account);
    }

    /// @notice Remove address from blocklist
    function removeFromBlocklist(address account) external onlyAdmin {
        if (!blocklist[account]) revert NotBlocked();
        blocklist[account] = false;
        emit RemovedFromBlocklist(account);
    }

    // ============ ICompliance Implementation ============

    /// @inheritdoc ICompliance
    function isCompliant(address sender, address recipient, uint256 amount) external view override returns (bool) {
        if (blocklist[sender] || blocklist[recipient]) return false;
        if (!allowlist[sender]) return false;
        if (amount < minimumAmount) return false;

        uint256 today = block.timestamp / 1 days;
        uint256 limit = customDailyLimits[sender] > 0 ? customDailyLimits[sender] : defaultDailyLimit;
        if (dailyUsage[sender][today] + amount > limit) return false;

        return true;
    }

    /// @inheritdoc ICompliance
    function getComplianceStatus(address account)
        external
        view
        override
        returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit)
    {
        uint256 today = block.timestamp / 1 days;
        isAllowed = allowlist[account] && !blocklist[account];
        dailyUsed = dailyUsage[account][today];
        dailyLimit = customDailyLimits[account] > 0 ? customDailyLimits[account] : defaultDailyLimit;
    }

    /// @inheritdoc ICompliance
    function recordUsage(address sender, uint256 amount) external override onlyHook {
        uint256 today = block.timestamp / 1 days;
        dailyUsage[sender][today] += amount;
    }

    /// @inheritdoc ICompliance
    function isBlocked(address account) external view override returns (bool) {
        return blocklist[account];
    }

    /// @inheritdoc ICompliance
    function getRemainingDailyLimit(address account) external view override returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 limit = customDailyLimits[account] > 0 ? customDailyLimits[account] : defaultDailyLimit;
        uint256 used = dailyUsage[account][today];
        if (used >= limit) return 0;
        return limit - used;
    }

    // ============ View Functions ============

    function getDailyLimit(address account) external view returns (uint256) {
        return customDailyLimits[account] > 0 ? customDailyLimits[account] : defaultDailyLimit;
    }

    function isOnAllowlist(address account) external view returns (bool) {
        return allowlist[account];
    }
}
