// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ICompliance } from "../interfaces/ICompliance.sol";
import { IWorldID } from "../interfaces/IWorldID.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title WorldcoinCompliance
/// @notice Phase 2 compliance implementation using World ID biometric verification
/// @author dev_jaytee
/// @dev Upgrades from AllowlistCompliance by replacing manual allowlist with World ID proof verification
contract WorldcoinCompliance is ICompliance, Ownable {
    // ============ State Variables ============

    /// @notice World ID router contract
    IWorldID public immutable worldId;

    /// @notice App ID for World ID (hashed for external nullifier)
    string public appId;

    /// @notice Action ID for remittance verification
    string public constant ACTION_ID = "remit";

    /// @notice Group ID for Orb verification
    uint256 public constant ORB_GROUP_ID = 1;

    /// @notice The hook contract that can record usage
    address public hook;

    /// @notice Addresses granted admin rights (blocklist/revocation operators)
    mapping(address => bool) public admins;

    /// @notice Nullifier hashes already used (prevent double-verification)
    mapping(uint256 => bool) public nullifierHashes;

    /// @notice Addresses verified via World ID
    mapping(address => bool) public verified;

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
    event WorldIDVerified(address indexed account, uint256 nullifierHash);
    event AddedToBlocklist(address indexed account);
    event RemovedFromBlocklist(address indexed account);
    event DailyLimitUpdated(address indexed account, uint256 newLimit);
    event DefaultDailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MinimumAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event HookUpdated(address indexed oldHook, address indexed newHook);
    event VerificationRevoked(address indexed account);

    // ============ Errors ============

    error NotAuthorized();
    error InvalidAddress();
    error InvalidAmount();
    error AlreadyVerified();
    error NullifierAlreadyUsed();
    error AlreadyBlocked();
    error NotBlocked();
    error InvalidProof();

    // ============ Constructor ============

    /// @param _worldId The World ID router contract address
    /// @param _appId The application ID for World ID
    constructor(IWorldID _worldId, string memory _appId) Ownable(msg.sender) {
        if (address(_worldId) == address(0)) revert InvalidAddress();
        worldId = _worldId;
        appId = _appId;
    }

    // ============ Modifiers ============

    modifier onlyHook() {
        if (msg.sender != hook) revert NotAuthorized();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != owner() && !admins[msg.sender]) revert NotAuthorized();
        _;
    }

    // ============ World ID Verification ============

    /// @notice Verify a World ID proof and register the sender as verified
    /// @param signal The signal (user's address to verify)
    /// @param root The World ID merkle root
    /// @param nullifierHash The nullifier hash (unique per user per action)
    /// @param proof The zero-knowledge proof
    function verifyAndRegister(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (signal == address(0)) revert InvalidAddress();
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadyUsed();

        // Compute external nullifier hash from appId and actionId
        uint256 externalNullifierHash = uint256(
            keccak256(abi.encodePacked(appId, ACTION_ID))
        );

        // Compute signal hash
        uint256 signalHash = uint256(keccak256(abi.encodePacked(signal)));

        // Verify the proof via World ID router (reverts on failure)
        worldId.verifyProof(
            root,
            ORB_GROUP_ID,
            signalHash,
            nullifierHash,
            externalNullifierHash,
            proof
        );

        // Mark nullifier as used
        nullifierHashes[nullifierHash] = true;

        // Mark address as verified
        verified[signal] = true;

        emit WorldIDVerified(signal, nullifierHash);
    }

    // ============ Admin Functions ============

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

    /// @notice Set the hook contract address
    /// @param _hook The hook contract address
    function setHook(address _hook) external onlyOwner {
        if (_hook == address(0)) revert InvalidAddress();
        emit HookUpdated(hook, _hook);
        hook = _hook;
    }

    /// @notice Add address to blocklist
    /// @param account The address to block
    function addToBlocklist(address account) external onlyAdmin {
        if (account == address(0)) revert InvalidAddress();
        if (blocklist[account]) revert AlreadyBlocked();

        blocklist[account] = true;
        emit AddedToBlocklist(account);
    }

    /// @notice Remove address from blocklist
    /// @param account The address to unblock
    function removeFromBlocklist(address account) external onlyAdmin {
        if (!blocklist[account]) revert NotBlocked();

        blocklist[account] = false;
        emit RemovedFromBlocklist(account);
    }

    /// @notice Revoke verification for an address
    /// @param account The address to revoke
    function revokeVerification(address account) external onlyAdmin {
        verified[account] = false;
        emit VerificationRevoked(account);
    }

    /// @notice Update daily limit for an address
    /// @param account The address to update
    /// @param newLimit The new daily limit
    function updateDailyLimit(address account, uint256 newLimit) external onlyOwner {
        customDailyLimits[account] = newLimit;
        emit DailyLimitUpdated(account, newLimit);
    }

    /// @notice Update default daily limit
    /// @param newLimit The new default daily limit
    function setDefaultDailyLimit(uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert InvalidAmount();
        emit DefaultDailyLimitUpdated(defaultDailyLimit, newLimit);
        defaultDailyLimit = newLimit;
    }

    /// @notice Update minimum amount
    /// @param newMinimum The new minimum amount
    function setMinimumAmount(uint256 newMinimum) external onlyOwner {
        emit MinimumAmountUpdated(minimumAmount, newMinimum);
        minimumAmount = newMinimum;
    }

    // ============ ICompliance Implementation ============

    /// @inheritdoc ICompliance
    function isCompliant(address sender, address recipient, uint256 amount) external view override returns (bool) {
        // Check blocklist
        if (blocklist[sender] || blocklist[recipient]) {
            return false;
        }

        // Check World ID verification (replaces allowlist check)
        if (!verified[sender]) {
            return false;
        }

        // Check minimum amount
        if (amount < minimumAmount) {
            return false;
        }

        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 limit = customDailyLimits[sender] > 0 ? customDailyLimits[sender] : defaultDailyLimit;
        uint256 used = dailyUsage[sender][today];

        if (used + amount > limit) {
            return false;
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
        isAllowed = verified[account] && !blocklist[account];
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

        if (used >= limit) {
            return 0;
        }
        return limit - used;
    }

    // ============ View Functions ============

    /// @notice Check if an address is verified via World ID
    /// @param account The address to check
    /// @return True if verified
    function isVerified(address account) external view returns (bool) {
        return verified[account];
    }

    /// @notice Get daily limit for an address
    /// @param account The address to check
    /// @return The daily limit
    function getDailyLimit(address account) external view returns (uint256) {
        return customDailyLimits[account] > 0 ? customDailyLimits[account] : defaultDailyLimit;
    }
}
