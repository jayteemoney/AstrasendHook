// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ICompliance } from "../interfaces/ICompliance.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title OpenCompliance
/// @notice Open-by-default compliance — every wallet can transact immediately.
///         Owner controls critical settings. Admins handle operational blocklist management.
/// @author dev_jaytee
contract OpenCompliance is ICompliance, Ownable {
    // ============ State Variables ============

    /// @notice The hook contract that can record usage
    address public hook;

    /// @notice Addresses granted admin rights (blocklist operators)
    mapping(address => bool) public admins;

    /// @notice Blocked addresses (sanctions / bad actors)
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
    error AlreadyBlocked();
    error NotBlocked();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

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

    /// @notice Update the default daily limit for all users
    function setDefaultDailyLimit(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert InvalidAmount();
        emit DefaultDailyLimitUpdated(defaultDailyLimit, newLimit);
        defaultDailyLimit = newLimit;
    }

    /// @notice Update minimum transfer amount
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

    /// @notice Block an address (bad actor / sanctions)
    function addToBlocklist(address account) external onlyAdmin {
        if (account == address(0)) revert InvalidAddress();
        if (blocklist[account]) revert AlreadyBlocked();
        blocklist[account] = true;
        emit AddedToBlocklist(account);
    }

    /// @notice Unblock an address
    function removeFromBlocklist(address account) external onlyAdmin {
        if (!blocklist[account]) revert NotBlocked();
        blocklist[account] = false;
        emit RemovedFromBlocklist(account);
    }

    // ============ ICompliance Implementation ============

    /// @inheritdoc ICompliance
    function isCompliant(address sender, address recipient, uint256 amount) external view override returns (bool) {
        if (blocklist[sender] || blocklist[recipient]) return false;
        if (amount > 0 && amount < minimumAmount) return false;

        if (amount > 0) {
            uint256 today = block.timestamp / 1 days;
            uint256 limit = customDailyLimits[sender] > 0 ? customDailyLimits[sender] : defaultDailyLimit;
            if (dailyUsage[sender][today] + amount > limit) return false;
        }

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
        isAllowed = !blocklist[account];
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
}
