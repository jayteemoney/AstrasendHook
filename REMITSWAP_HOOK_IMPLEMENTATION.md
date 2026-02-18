# RemitSwapHook: Uniswap v4 Implementation Plan

> **Project**: RemitEasy - Cross-Border Remittance Hook for Uniswap v4
> **Program**: Uniswap Hook Incubator (UHI8) - January 2026 Cohort
> **Author**: dev_jaytee
> **Status**: Implementation Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technical Specifications](#3-technical-specifications)
4. [Smart Contract Design](#4-smart-contract-design)
5. [Hook Implementation Details](#5-hook-implementation-details)
6. [Compliance Module](#6-compliance-module)
7. [Escrow & Release Logic](#7-escrow--release-logic)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment Plan](#9-deployment-plan)
10. [Security Considerations](#10-security-considerations)
11. [Questions & Decisions Needed](#11-questions--decisions-needed)
12. [References & Resources](#12-references--resources)

---

## 1. Executive Summary

### Problem Statement
Cross-border remittances cost an average of 6.2% globally, with some corridors charging up to 15%. Traditional services are slow (3-5 days), opaque, and exclude the unbanked.

### Solution
**RemitSwapHook** is a Uniswap v4 hook that enables low-cost, compliant cross-border remittances with:
- **< 1% total fees** (vs 6-15% traditional)
- **On-chain compliance** (KYC via allowlist, upgradeable to Worldcoin)
- **Group contributions** (multiple senders pool funds for one recipient)
- **USDT corridor** (global stablecoin, same-asset transfers)
- **Instant settlement** (blockchain-speed, not days)

### Key Innovation
First Uniswap v4 hook combining **compliance gating** + **escrow management** + **group funding** in a single, composable DeFi primitive.

---

## 2. Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REMITSWAP HOOK SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SENDER(S)                    UNISWAP V4                     RECIPIENT     │
│   ┌──────┐                    ┌──────────┐                    ┌──────┐     │
│   │ USA  │──── USDT ────────▶│          │                    │Kenya │     │
│   └──────┘                    │   Pool   │                    └──────┘     │
│   ┌──────┐                    │  Manager │                        ▲        │
│   │ UK   │──── USDT ────────▶│          │                        │        │
│   └──────┘                    │ + Hook   │──── USDT ─────────────┘        │
│   ┌──────┐                    │          │     (when target met)           │
│   │ NGR  │──── USDT ────────▶│          │                                 │
│   └──────┘                    └──────────┘                                 │
│                                    │                                        │
│                                    ▼                                        │
│                          ┌─────────────────┐                               │
│                          │  RemitSwapHook  │                               │
│                          ├─────────────────┤                               │
│                          │ ┌─────────────┐ │                               │
│                          │ │ beforeSwap  │ │◀── Compliance Check           │
│                          │ └─────────────┘ │                               │
│                          │ ┌─────────────┐ │                               │
│                          │ │  afterSwap  │ │◀── Escrow + Track             │
│                          │ └─────────────┘ │                               │
│                          │ ┌─────────────┐ │                               │
│                          │ │   Escrow    │ │◀── Hold Funds                 │
│                          │ └─────────────┘ │                               │
│                          │ ┌─────────────┐ │                               │
│                          │ │ Compliance  │ │◀── Allowlist/Worldcoin        │
│                          │ └─────────────┘ │                               │
│                          └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      RemitSwapHook.sol                       │
│                    (Main Hook Contract)                      │
├──────────────────────────────────────────────────────────────┤
│  - beforeSwap()     → Compliance verification                │
│  - afterSwap()      → Escrow deposit + tracking              │
│  - createRemittance() → Initialize new remittance            │
│  - releaseRemittance() → Recipient claims funds              │
│  - cancelRemittance()  → Creator cancels + refunds           │
└──────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ICompliance.sol  │ │ RemitTypes.sol   │ │ RemitEscrow.sol  │
│   (Interface)    │ │  (Lib/Types)     │ │   (Storage)      │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ - isCompliant()  │ │ - Remittance     │ │ - deposits       │
│ - checkLimits()  │ │ - Contributor    │ │ - withdrawals    │
│ - getStatus()    │ │ - Status enum    │ │ - balances       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│ AllowlistCompl.  │  OR   │ WorldcoinCompl.  │
│     .sol         │       │     .sol         │
├──────────────────┤       ├──────────────────┤
│ - allowlist      │       │ - worldId        │
│ - dailyLimits    │       │ - nullifiers     │
│ - addToList()    │       │ - verifyProof()  │
└──────────────────┘       └──────────────────┘
```

---

## 3. Technical Specifications

### Target Chains (Uniswap v4 Deployed)

| Chain | Chain ID | PoolManager Address | Priority |
|-------|----------|---------------------|----------|
| **Base** | 8453 | `0x498581ff718922c3f8e6a244956af099b2652b2b` | Primary |
| **Arbitrum** | 42161 | See [docs](https://docs.uniswap.org/contracts/v4/deployments) | Secondary |
| **Ethereum** | 1 | `0x000000000004444c5dc75cb358380d2e3de08a90` | Future |
| **Optimism** | 10 | `0x9a13f98cb987694c9f086b1f5eb990eea8264ec3` | Future |

> **Recommendation**: Start with **Base** - low fees, high adoption, Coinbase backing.

### Token Corridor

| From | To | Rationale |
|------|----|-----------|
| USDT | USDT | Global stablecoin, 100B+ market cap, available on all chains |

> **Note**: USDT→USDT means no currency conversion needed. The hook manages compliance + escrow only. Future versions can add auto-swap for other corridors.

### Development Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Foundry** | Stable | Smart contract development |
| **Solidity** | 0.8.26 | Required for transient storage |
| **v4-core** | Latest | Uniswap v4 core contracts |
| **v4-periphery** | Latest | BaseHook and utilities |
| **OpenZeppelin** | 5.x | Security utilities |

### Foundry Configuration

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.26"
evm_version = "cancun"
ffi = true
via_ir = true
optimizer = true
optimizer_runs = 1000000

[fuzz]
runs = 1000

[invariant]
runs = 256
depth = 32
```

---

## 4. Smart Contract Design

### Directory Structure

```
v4-hook/
├── foundry.toml
├── remappings.txt
├── src/
│   ├── RemitSwapHook.sol           # Main hook contract
│   ├── compliance/
│   │   ├── ICompliance.sol         # Compliance interface
│   │   ├── AllowlistCompliance.sol # Simple allowlist implementation
│   │   ├── WorldcoinCompliance.sol # Worldcoin World ID integration
│   │   └── PhoneNumberResolver.sol # Phone-to-address mapping
│   ├── libraries/
│   │   └── RemitTypes.sol          # Shared types and structs
│   └── interfaces/
│       ├── IRemitSwapHook.sol      # Hook interface
│       └── IPhoneNumberResolver.sol # Phone resolver interface
├── test/
│   ├── RemitSwapHook.t.sol         # Main hook tests
│   ├── Compliance.t.sol            # Compliance module tests
│   ├── Escrow.t.sol                # Escrow logic tests
│   ├── Integration.t.sol           # Full flow integration tests
│   └── utils/
│       ├── HookTest.sol            # Base test utilities
│       └── Fixtures.sol            # Test fixtures
├── script/
│   ├── Deploy.s.sol                # Deployment script
│   ├── CreatePool.s.sol            # Pool creation with hook
│   └── Interactions.s.sol          # Demo interactions
└── lib/
    ├── v4-core/                    # forge install uniswap/v4-core
    ├── v4-periphery/               # forge install uniswap/v4-periphery
    └── openzeppelin-contracts/     # forge install openzeppelin/openzeppelin-contracts
```

### Core Data Structures

```solidity
// src/libraries/RemitTypes.sol

library RemitTypes {
    /// @notice Status of a remittance
    enum Status {
        Active,     // Accepting contributions
        Released,   // Funds sent to recipient
        Cancelled,  // Creator cancelled, contributors refunded
        Expired     // Past deadline, can be claimed or refunded
    }

    /// @notice Individual contribution record
    struct Contribution {
        address contributor;
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice Main remittance structure
    struct Remittance {
        uint256 id;
        address creator;
        address recipient;
        address token;              // USDT address
        uint256 targetAmount;       // Goal amount
        uint256 currentAmount;      // Collected so far
        uint256 platformFeeBps;     // Fee in basis points (e.g., 50 = 0.5%)
        uint256 createdAt;
        uint256 expiresAt;          // Optional deadline
        bytes32 purposeHash;        // IPFS hash or keccak256 of purpose string
        Status status;
        address[] contributorList;
        mapping(address => uint256) contributions;
    }

    /// @notice Hook data passed through swaps
    struct RemitHookData {
        uint256 remittanceId;       // Which remittance to contribute to
        bool isContribution;        // True if this swap is a contribution
    }

    /// @notice Events
    event RemittanceCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        uint256 targetAmount,
        uint256 expiresAt
    );

    event ContributionMade(
        uint256 indexed remittanceId,
        address indexed contributor,
        uint256 amount,
        uint256 newTotal
    );

    event RemittanceReleased(
        uint256 indexed remittanceId,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );

    event RemittanceCancelled(
        uint256 indexed remittanceId,
        address indexed creator,
        uint256 refundedAmount
    );
}
```

---

## 5. Hook Implementation Details

### Hook Permissions

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: true,           // ✅ Compliance check
        afterSwap: true,            // ✅ Escrow deposit
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: false,
        afterSwapReturnDelta: true, // ✅ Capture swap output for escrow
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

### beforeSwap Implementation

```solidity
/// @notice Called before every swap - validates compliance
/// @param sender The address initiating the swap
/// @param key The pool key
/// @param params Swap parameters
/// @param hookData Encoded RemitHookData
function beforeSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata hookData
) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
    // 1. Decode hook data
    if (hookData.length == 0) {
        // Not a remittance swap, allow normal swap
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    RemitTypes.RemitHookData memory data = abi.decode(hookData, (RemitTypes.RemitHookData));

    if (!data.isContribution) {
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // 2. Validate remittance exists and is active
    RemitTypes.Remittance storage remit = remittances[data.remittanceId];
    require(remit.status == RemitTypes.Status.Active, "Remittance not active");
    require(block.timestamp < remit.expiresAt || remit.expiresAt == 0, "Remittance expired");

    // 3. Check compliance
    require(
        compliance.isCompliant(sender, remit.recipient, uint256(params.amountSpecified)),
        "Compliance check failed"
    );

    // 4. Check sender is not the recipient (anti-fraud)
    require(sender != remit.recipient, "Recipient cannot contribute");

    return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
}
```

### afterSwap Implementation

```solidity
/// @notice Called after every swap - handles escrow
/// @param sender The address that initiated the swap
/// @param key The pool key
/// @param params Swap parameters
/// @param delta The balance changes from the swap
/// @param hookData Encoded RemitHookData
function afterSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    BalanceDelta delta,
    bytes calldata hookData
) external override onlyPoolManager returns (bytes4, int128) {
    if (hookData.length == 0) {
        return (this.afterSwap.selector, 0);
    }

    RemitTypes.RemitHookData memory data = abi.decode(hookData, (RemitTypes.RemitHookData));

    if (!data.isContribution) {
        return (this.afterSwap.selector, 0);
    }

    RemitTypes.Remittance storage remit = remittances[data.remittanceId];

    // Calculate contribution amount from swap delta
    // For USDT contribution, we capture the input amount
    int128 amount0 = delta.amount0();
    int128 amount1 = delta.amount1();

    // Determine which token is USDT and get the contribution amount
    uint256 contributionAmount;
    if (key.currency0 == Currency.wrap(remit.token)) {
        contributionAmount = amount0 < 0 ? uint256(uint128(-amount0)) : 0;
    } else {
        contributionAmount = amount1 < 0 ? uint256(uint128(-amount1)) : 0;
    }

    require(contributionAmount > 0, "No contribution detected");

    // Update remittance state
    remit.currentAmount += contributionAmount;
    remit.contributions[sender] += contributionAmount;

    if (remit.contributions[sender] == contributionAmount) {
        // First contribution from this address
        remit.contributorList.push(sender);
    }

    emit RemitTypes.ContributionMade(
        data.remittanceId,
        sender,
        contributionAmount,
        remit.currentAmount
    );

    // Auto-release if target met (optional feature)
    if (remit.currentAmount >= remit.targetAmount && autoReleaseEnabled) {
        _releaseRemittance(data.remittanceId);
    }

    // Return delta adjustment to route funds to escrow
    // This tells PoolManager to send tokens to hook instead of completing swap
    return (this.afterSwap.selector, int128(uint128(contributionAmount)));
}
```

### Remittance Management Functions

```solidity
/// @notice Create a new remittance
/// @param recipient Address to receive funds
/// @param targetAmount Total amount to collect
/// @param expiresAt Optional deadline (0 for no expiry)
/// @param purposeHash IPFS hash or keccak256 of purpose
function createRemittance(
    address recipient,
    uint256 targetAmount,
    uint256 expiresAt,
    bytes32 purposeHash
) external returns (uint256 remittanceId) {
    require(recipient != address(0), "Invalid recipient");
    require(recipient != msg.sender, "Cannot send to self");
    require(targetAmount > 0, "Amount must be positive");
    require(
        expiresAt == 0 || expiresAt > block.timestamp,
        "Invalid expiry"
    );

    // Compliance check for creator
    require(compliance.isCompliant(msg.sender, recipient, targetAmount), "Creator not compliant");

    remittanceId = nextRemittanceId++;

    RemitTypes.Remittance storage remit = remittances[remittanceId];
    remit.id = remittanceId;
    remit.creator = msg.sender;
    remit.recipient = recipient;
    remit.token = USDT;
    remit.targetAmount = targetAmount;
    remit.platformFeeBps = platformFeeBps;
    remit.createdAt = block.timestamp;
    remit.expiresAt = expiresAt;
    remit.purposeHash = purposeHash;
    remit.status = RemitTypes.Status.Active;

    // Track remittances by user
    userRemittances[msg.sender].push(remittanceId);
    recipientRemittances[recipient].push(remittanceId);

    emit RemitTypes.RemittanceCreated(
        remittanceId,
        msg.sender,
        recipient,
        targetAmount,
        expiresAt
    );
}

/// @notice Release funds to recipient (only recipient can call)
/// @param remittanceId The remittance to release
function releaseRemittance(uint256 remittanceId) external {
    RemitTypes.Remittance storage remit = remittances[remittanceId];

    require(msg.sender == remit.recipient, "Only recipient can release");
    require(remit.status == RemitTypes.Status.Active, "Not active");
    require(remit.currentAmount >= remit.targetAmount, "Target not met");

    _releaseRemittance(remittanceId);
}

/// @notice Internal release logic
function _releaseRemittance(uint256 remittanceId) internal {
    RemitTypes.Remittance storage remit = remittances[remittanceId];

    remit.status = RemitTypes.Status.Released;

    uint256 amount = remit.currentAmount;
    uint256 fee = (amount * remit.platformFeeBps) / 10000;
    uint256 recipientAmount = amount - fee;

    // Transfer to recipient
    IERC20(remit.token).safeTransfer(remit.recipient, recipientAmount);

    // Transfer fee to collector
    if (fee > 0) {
        IERC20(remit.token).safeTransfer(feeCollector, fee);
    }

    emit RemitTypes.RemittanceReleased(
        remittanceId,
        remit.recipient,
        recipientAmount,
        fee
    );
}

/// @notice Cancel remittance and refund contributors (only creator)
/// @param remittanceId The remittance to cancel
function cancelRemittance(uint256 remittanceId) external nonReentrant {
    RemitTypes.Remittance storage remit = remittances[remittanceId];

    require(msg.sender == remit.creator, "Only creator can cancel");
    require(remit.status == RemitTypes.Status.Active, "Not active");

    remit.status = RemitTypes.Status.Cancelled;

    // Refund all contributors
    uint256 totalRefunded = 0;
    for (uint256 i = 0; i < remit.contributorList.length; i++) {
        address contributor = remit.contributorList[i];
        uint256 contribution = remit.contributions[contributor];

        if (contribution > 0) {
            remit.contributions[contributor] = 0;
            IERC20(remit.token).safeTransfer(contributor, contribution);
            totalRefunded += contribution;
        }
    }

    emit RemitTypes.RemittanceCancelled(remittanceId, msg.sender, totalRefunded);
}
```

---

## 6. Compliance Module

### Interface

```solidity
// src/compliance/ICompliance.sol

interface ICompliance {
    /// @notice Check if a transfer is compliant
    /// @param sender The address sending funds
    /// @param recipient The address receiving funds
    /// @param amount The amount being transferred
    /// @return True if compliant
    function isCompliant(
        address sender,
        address recipient,
        uint256 amount
    ) external view returns (bool);

    /// @notice Get compliance status details
    /// @param account The address to check
    /// @return isAllowed Whether account is on allowlist
    /// @return dailyUsed Amount used today
    /// @return dailyLimit Daily limit
    function getComplianceStatus(address account)
        external
        view
        returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit);
}
```

### Allowlist Implementation (Phase 1)

```solidity
// src/compliance/AllowlistCompliance.sol

contract AllowlistCompliance is ICompliance, Ownable {
    /// @notice Allowlist of verified addresses
    mapping(address => bool) public allowlist;

    /// @notice Daily limits per address
    mapping(address => uint256) public dailyLimits;

    /// @notice Default daily limit
    uint256 public defaultDailyLimit = 10_000 * 1e6; // 10,000 USDT

    /// @notice Daily usage tracking (resets at midnight UTC)
    mapping(address => mapping(uint256 => uint256)) public dailyUsage;

    /// @notice Blocked addresses (sanctions list)
    mapping(address => bool) public blocklist;

    /// @notice Add address to allowlist
    function addToAllowlist(address account, uint256 customLimit) external onlyOwner {
        allowlist[account] = true;
        if (customLimit > 0) {
            dailyLimits[account] = customLimit;
        }
        emit AddedToAllowlist(account, customLimit);
    }

    /// @notice Remove from allowlist
    function removeFromAllowlist(address account) external onlyOwner {
        allowlist[account] = false;
        emit RemovedFromAllowlist(account);
    }

    /// @notice Add to blocklist (sanctions)
    function addToBlocklist(address account) external onlyOwner {
        blocklist[account] = true;
        emit AddedToBlocklist(account);
    }

    /// @notice Check compliance
    function isCompliant(
        address sender,
        address recipient,
        uint256 amount
    ) external view override returns (bool) {
        // 1. Check blocklist
        if (blocklist[sender] || blocklist[recipient]) {
            return false;
        }

        // 2. Check allowlist
        if (!allowlist[sender]) {
            return false;
        }

        // 3. Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 limit = dailyLimits[sender] > 0 ? dailyLimits[sender] : defaultDailyLimit;
        uint256 used = dailyUsage[sender][today];

        if (used + amount > limit) {
            return false;
        }

        return true;
    }

    /// @notice Record usage (called by hook after successful contribution)
    function recordUsage(address sender, uint256 amount) external {
        require(msg.sender == hook, "Only hook can record");
        uint256 today = block.timestamp / 1 days;
        dailyUsage[sender][today] += amount;
    }

    /// @notice Get compliance status
    function getComplianceStatus(address account)
        external
        view
        override
        returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit)
    {
        uint256 today = block.timestamp / 1 days;
        isAllowed = allowlist[account] && !blocklist[account];
        dailyUsed = dailyUsage[account][today];
        dailyLimit = dailyLimits[account] > 0 ? dailyLimits[account] : defaultDailyLimit;
    }

    // Events
    event AddedToAllowlist(address indexed account, uint256 customLimit);
    event RemovedFromAllowlist(address indexed account);
    event AddedToBlocklist(address indexed account);
}
```

### Worldcoin Implementation (Phase 2 - Optional Upgrade)

```solidity
// src/compliance/WorldcoinCompliance.sol

import {IWorldID} from "@worldcoin/world-id-contracts/interfaces/IWorldID.sol";

contract WorldcoinCompliance is ICompliance, Ownable {
    /// @notice World ID router contract
    IWorldID public immutable worldId;

    /// @notice App ID for World ID
    string public appId;

    /// @notice Action ID for remittance
    string public actionId = "remit";

    /// @notice Nullifier hashes to prevent double-verification
    mapping(uint256 => bool) public nullifierHashes;

    /// @notice Verified addresses
    mapping(address => bool) public verified;

    /// @notice Daily limits (same as allowlist)
    mapping(address => uint256) public dailyLimits;
    mapping(address => mapping(uint256 => uint256)) public dailyUsage;
    uint256 public defaultDailyLimit = 10_000 * 1e6;

    constructor(IWorldID _worldId, string memory _appId) {
        worldId = _worldId;
        appId = _appId;
    }

    /// @notice Verify World ID proof and add to verified list
    /// @param signal The signal (user's address)
    /// @param root The World ID merkle root
    /// @param nullifierHash The nullifier hash
    /// @param proof The zero-knowledge proof
    function verifyAndRegister(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        // Prevent double-verification
        require(!nullifierHashes[nullifierHash], "Already verified");

        // Compute external nullifier hash
        uint256 externalNullifierHash = uint256(
            keccak256(abi.encodePacked(appId, actionId))
        );

        // Verify the proof
        worldId.verifyProof(
            root,
            1, // groupId for Orb verification
            uint256(keccak256(abi.encodePacked(signal))),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        // Mark as verified
        nullifierHashes[nullifierHash] = true;
        verified[signal] = true;

        emit WorldIDVerified(signal, nullifierHash);
    }

    /// @notice Check compliance
    function isCompliant(
        address sender,
        address recipient,
        uint256 amount
    ) external view override returns (bool) {
        // Must be verified via World ID
        if (!verified[sender]) {
            return false;
        }

        // Check daily limits
        uint256 today = block.timestamp / 1 days;
        uint256 limit = dailyLimits[sender] > 0 ? dailyLimits[sender] : defaultDailyLimit;
        uint256 used = dailyUsage[sender][today];

        return used + amount <= limit;
    }

    event WorldIDVerified(address indexed account, uint256 nullifierHash);
}
```

### Phone Number Resolver (For UHI8 Demo)

```solidity
// src/compliance/PhoneNumberResolver.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PhoneNumberResolver
/// @notice Resolves phone numbers to wallet addresses for remittances
/// @dev Uses a simple mapping for demo; production would integrate with Celo SocialConnect
contract PhoneNumberResolver is Ownable {
    /// @notice Mapping of phone number hash to wallet address
    /// @dev Phone numbers are hashed for privacy: keccak256(abi.encodePacked(phoneNumber))
    mapping(bytes32 => address) public phoneToAddress;

    /// @notice Mapping of address to phone hash (reverse lookup)
    mapping(address => bytes32) public addressToPhone;

    /// @notice Check if a phone number is registered
    mapping(bytes32 => bool) public isRegistered;

    /// @notice Event emitted when a phone number is registered
    event PhoneRegistered(bytes32 indexed phoneHash, address indexed wallet);

    /// @notice Event emitted when a phone number is unregistered
    event PhoneUnregistered(bytes32 indexed phoneHash, address indexed wallet);

    constructor() Ownable(msg.sender) {}

    /// @notice Register a phone number to a wallet address
    /// @param phoneHash The keccak256 hash of the phone number (e.g., "+254712345678")
    /// @param wallet The wallet address to associate
    function registerPhone(bytes32 phoneHash, address wallet) external onlyOwner {
        require(wallet != address(0), "Invalid wallet");
        require(!isRegistered[phoneHash], "Phone already registered");
        require(addressToPhone[wallet] == bytes32(0), "Wallet already has phone");

        phoneToAddress[phoneHash] = wallet;
        addressToPhone[wallet] = phoneHash;
        isRegistered[phoneHash] = true;

        emit PhoneRegistered(phoneHash, wallet);
    }

    /// @notice Batch register multiple phone numbers (for demo setup)
    /// @param phoneHashes Array of phone number hashes
    /// @param wallets Array of wallet addresses
    function batchRegister(bytes32[] calldata phoneHashes, address[] calldata wallets) external onlyOwner {
        require(phoneHashes.length == wallets.length, "Length mismatch");

        for (uint256 i = 0; i < phoneHashes.length; i++) {
            if (!isRegistered[phoneHashes[i]] && wallets[i] != address(0)) {
                phoneToAddress[phoneHashes[i]] = wallets[i];
                addressToPhone[wallets[i]] = phoneHashes[i];
                isRegistered[phoneHashes[i]] = true;
                emit PhoneRegistered(phoneHashes[i], wallets[i]);
            }
        }
    }

    /// @notice Unregister a phone number
    /// @param phoneHash The phone number hash to unregister
    function unregisterPhone(bytes32 phoneHash) external onlyOwner {
        require(isRegistered[phoneHash], "Phone not registered");

        address wallet = phoneToAddress[phoneHash];
        delete phoneToAddress[phoneHash];
        delete addressToPhone[wallet];
        isRegistered[phoneHash] = false;

        emit PhoneUnregistered(phoneHash, wallet);
    }

    /// @notice Resolve a phone number to a wallet address
    /// @param phoneHash The phone number hash
    /// @return wallet The associated wallet address (address(0) if not found)
    function resolve(bytes32 phoneHash) external view returns (address wallet) {
        return phoneToAddress[phoneHash];
    }

    /// @notice Helper to compute phone hash (can also be done off-chain)
    /// @param phoneNumber The phone number string (e.g., "+254712345678")
    /// @return The keccak256 hash
    function computePhoneHash(string calldata phoneNumber) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(phoneNumber));
    }

    /// @notice Check if an address has a registered phone
    /// @param wallet The wallet address to check
    /// @return True if the address has a registered phone number
    function hasPhone(address wallet) external view returns (bool) {
        return addressToPhone[wallet] != bytes32(0);
    }
}
```

### Demo Test Phone Numbers

For UHI8 demo purposes, pre-register these test phone numbers:

| Country | Phone Number | Phone Hash (keccak256) |
|---------|--------------|------------------------|
| Kenya | +254712345678 | `0x...` (computed at deploy) |
| Nigeria | +2348061234567 | `0x...` |
| Ghana | +233201234567 | `0x...` |
| Uganda | +256701234567 | `0x...` |
| UK | +447911123456 | `0x...` |
| USA | +14155551234 | `0x...` |

### Integration with RemitSwapHook

```solidity
// In RemitSwapHook.sol - add phone-based remittance creation

/// @notice Phone number resolver contract
IPhoneNumberResolver public phoneResolver;

/// @notice Create remittance using recipient's phone number
/// @param recipientPhoneHash The keccak256 hash of recipient's phone number
/// @param targetAmount Total amount to collect
/// @param expiresAt Optional deadline
/// @param purposeHash Purpose description hash
/// @param autoRelease Whether to auto-release when target is met
function createRemittanceByPhone(
    bytes32 recipientPhoneHash,
    uint256 targetAmount,
    uint256 expiresAt,
    bytes32 purposeHash,
    bool autoRelease
) external returns (uint256 remittanceId) {
    // Resolve phone to address
    address recipient = phoneResolver.resolve(recipientPhoneHash);
    require(recipient != address(0), "Phone not registered");

    // Use standard creation logic
    return _createRemittance(
        msg.sender,
        recipient,
        targetAmount,
        expiresAt,
        purposeHash,
        autoRelease
    );
}
```

---

## 7. Escrow & Release Logic

### Escrow Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ESCROW FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATE                                                      │
│     ┌────────┐                                                  │
│     │ Creator│──── createRemittance() ──▶ Remittance Created   │
│     └────────┘                                                  │
│                                                                 │
│  2. CONTRIBUTE                                                  │
│     ┌────────┐      ┌───────────┐      ┌────────────┐          │
│     │Contrib.│──▶   │ Uniswap   │ ──▶  │RemitSwap   │          │
│     │(swap)  │      │PoolManager│      │Hook(escrow)│          │
│     └────────┘      └───────────┘      └────────────┘          │
│         │                                    │                  │
│         │                                    ▼                  │
│         │                           ┌──────────────┐           │
│         └───── USDT ───────────────▶│  Hook Holds  │           │
│                                     │    Funds     │           │
│                                     └──────────────┘           │
│                                                                 │
│  3. RELEASE (when target met)                                  │
│     ┌─────────┐                     ┌──────────────┐           │
│     │Recipient│── releaseRemittance()│  Hook       │           │
│     └─────────┘                     │  Releases   │            │
│         ▲                           └──────────────┘           │
│         │                                  │                   │
│         │                    ┌─────────────┴─────────────┐     │
│         │                    ▼                           ▼     │
│         │           ┌──────────────┐            ┌───────────┐  │
│         └─────────  │ Amount - Fee │            │ Fee to    │  │
│            USDT     │ to Recipient │            │ Collector │  │
│                     └──────────────┘            └───────────┘  │
│                                                                 │
│  4. CANCEL (if needed)                                         │
│     ┌────────┐                                                  │
│     │Creator │── cancelRemittance() ──▶ All Contributors       │
│     └────────┘                          Refunded               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fund Custody

The hook contract holds USDT in escrow. Key considerations:

1. **Token Approval**: Contributors must approve the hook contract to spend their USDT
2. **Balance Tracking**: Hook tracks per-remittance and per-contributor balances
3. **Withdrawal**: Only via `releaseRemittance()` or `cancelRemittance()`

---

## 8. Testing Strategy

### Test Categories

```solidity
// test/RemitSwapHook.t.sol

contract RemitSwapHookTest is HookTest {

    // ============ Setup Tests ============

    function test_HookDeployment() public { }
    function test_HookPermissions() public { }
    function test_PoolInitialization() public { }

    // ============ Remittance Creation Tests ============

    function test_CreateRemittance_Success() public { }
    function test_CreateRemittance_RevertIfZeroRecipient() public { }
    function test_CreateRemittance_RevertIfZeroAmount() public { }
    function test_CreateRemittance_RevertIfSelfRecipient() public { }
    function test_CreateRemittance_RevertIfNotCompliant() public { }
    function test_CreateRemittance_WithExpiry() public { }

    // ============ Contribution Tests ============

    function test_Contribute_Success() public { }
    function test_Contribute_MultipleContributors() public { }
    function test_Contribute_RevertIfNotCompliant() public { }
    function test_Contribute_RevertIfRemittanceCancelled() public { }
    function test_Contribute_RevertIfRemittanceReleased() public { }
    function test_Contribute_RevertIfExpired() public { }
    function test_Contribute_RevertIfRecipientContributes() public { }
    function test_Contribute_UpdatesBalance() public { }
    function test_Contribute_TracksContributorList() public { }

    // ============ Release Tests ============

    function test_Release_Success() public { }
    function test_Release_RevertIfNotRecipient() public { }
    function test_Release_RevertIfTargetNotMet() public { }
    function test_Release_RevertIfAlreadyReleased() public { }
    function test_Release_CalculatesFeeCorrectly() public { }
    function test_Release_TransfersToRecipient() public { }
    function test_Release_TransfersFeeToCollector() public { }

    // ============ Cancellation Tests ============

    function test_Cancel_Success() public { }
    function test_Cancel_RevertIfNotCreator() public { }
    function test_Cancel_RevertIfAlreadyReleased() public { }
    function test_Cancel_RefundsAllContributors() public { }
    function test_Cancel_RefundsCorrectAmounts() public { }

    // ============ Compliance Tests ============

    function test_Compliance_AllowlistCheck() public { }
    function test_Compliance_DailyLimitCheck() public { }
    function test_Compliance_BlocklistCheck() public { }
    function test_Compliance_LimitResetDaily() public { }

    // ============ Edge Cases ============

    function test_ExactTargetContribution() public { }
    function test_OverTargetContribution() public { }
    function test_ZeroContribution() public { }
    function test_ReentrancyProtection() public { }

    // ============ Fuzz Tests ============

    function testFuzz_Contribute(uint256 amount) public { }
    function testFuzz_MultipleContributions(uint256[] memory amounts) public { }
    function testFuzz_FeeCalculation(uint256 amount, uint256 feeBps) public { }

    // ============ Invariant Tests ============

    function invariant_TotalContributionsMatchBalance() public { }
    function invariant_ReleasedRemittancesAreImmutable() public { }
    function invariant_CancelledRemittancesFullyRefunded() public { }
}
```

### Test Utilities

```solidity
// test/utils/HookTest.sol

abstract contract HookTest is Test {
    using PoolIdLibrary for PoolKey;

    IPoolManager poolManager;
    RemitSwapHook hook;
    AllowlistCompliance compliance;

    Currency currency0; // USDT
    Currency currency1; // WETH or other
    PoolKey poolKey;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address feeCollector = makeAddr("feeCollector");

    uint256 constant INITIAL_BALANCE = 1_000_000 * 1e6; // 1M USDT

    function setUp() public virtual {
        // Deploy pool manager
        poolManager = new PoolManager();

        // Deploy compliance
        compliance = new AllowlistCompliance();

        // Deploy hook (address must match permissions)
        hook = new RemitSwapHook(poolManager, compliance, feeCollector);

        // Setup tokens
        // ... (mock USDT deployment)

        // Create pool with hook
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        poolManager.initialize(poolKey, SQRT_RATIO_1_1, "");

        // Fund test accounts
        deal(address(currency0), alice, INITIAL_BALANCE);
        deal(address(currency0), bob, INITIAL_BALANCE);
        deal(address(currency0), charlie, INITIAL_BALANCE);

        // Add to allowlist
        compliance.addToAllowlist(alice, 0);
        compliance.addToAllowlist(bob, 0);
        compliance.addToAllowlist(charlie, 0);
    }

    // Helper functions
    function _createRemittance(
        address creator,
        address recipient,
        uint256 amount
    ) internal returns (uint256) {
        vm.prank(creator);
        return hook.createRemittance(recipient, amount, 0, bytes32(0));
    }

    function _contribute(
        address contributor,
        uint256 remittanceId,
        uint256 amount
    ) internal {
        // Encode hook data
        bytes memory hookData = abi.encode(
            RemitTypes.RemitHookData({
                remittanceId: remittanceId,
                isContribution: true
            })
        );

        // Perform swap with hook data
        vm.prank(contributor);
        // ... swap logic
    }
}
```

---

## 9. Deployment Plan

### Phase 1: Local Testing
```bash
# Install dependencies
forge install

# Run tests
forge test -vvv

# Run specific test
forge test --match-test test_Contribute_Success -vvv

# Gas report
forge test --gas-report
```

### Phase 2: Testnet (Base Sepolia)

```solidity
// script/Deploy.s.sol

contract DeployRemitSwapHook is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy compliance
        AllowlistCompliance compliance = new AllowlistCompliance();

        // 2. Compute hook address (must match permissions)
        // Hook addresses encode permissions in the address itself
        bytes memory creationCode = type(RemitSwapHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            POOL_MANAGER,
            address(compliance),
            FEE_COLLECTOR
        );

        // Mine for valid hook address
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            hook.getHookPermissions(),
            creationCode,
            constructorArgs
        );

        // 3. Deploy hook at computed address
        RemitSwapHook hook = new RemitSwapHook{salt: salt}(
            IPoolManager(POOL_MANAGER),
            compliance,
            FEE_COLLECTOR
        );

        require(address(hook) == hookAddress, "Hook address mismatch");

        // 4. Setup compliance
        compliance.setHook(address(hook));

        vm.stopBroadcast();

        console.log("Compliance deployed at:", address(compliance));
        console.log("Hook deployed at:", address(hook));
    }
}
```

### Phase 3: Mainnet (Base)

1. Complete audit
2. Multi-sig ownership transfer
3. Gradual rollout with limits
4. Monitor and adjust

---

## 10. Security Considerations

### Potential Attack Vectors

| Vector | Mitigation |
|--------|------------|
| **Reentrancy** | OpenZeppelin ReentrancyGuard on all external state-changing functions |
| **Flash Loan Manipulation** | Contributions locked until release, no same-block arbitrage |
| **Compliance Bypass** | beforeSwap check cannot be skipped, enforced by PoolManager |
| **Front-running** | No MEV opportunity - fixed fee, no price impact |
| **Griefing** | Minimum contribution amount, gas limits |
| **Stuck Funds** | Expiry mechanism, emergency admin withdrawal |

### Audit Checklist

- [ ] Reentrancy protection on all state changes
- [ ] Integer overflow/underflow (Solidity 0.8+)
- [ ] Access control on admin functions
- [ ] Event emission for all state changes
- [ ] Input validation on all public functions
- [ ] Safe token transfer patterns (SafeERC20)
- [ ] Hook address encoding matches permissions
- [ ] No selfdestruct or delegatecall vulnerabilities

---

## 11. Design Decisions (Confirmed)

| Decision | Choice | Details |
|----------|--------|---------|
| **Pool Pair** | USDT/WETH | Hook intercepts USDT contributions from real Uniswap pool |
| **Auto-Release** | Configurable | Per-remittance flag: `autoRelease: true/false` |
| **Expiry Behavior** | Auto-refund | All contributors refunded when remittance expires |
| **Starting Chain** | Base | Low fees, high adoption, expand later |
| **Phone Integration** | Yes | Include phone-to-address resolution for UHI8 demo |
| **Fee Structure** | Fixed 0.5% | 50 basis points, future: volume discounts |

---

## 12. References & Resources

### Official Documentation

- [Uniswap v4 Hooks Concepts](https://docs.uniswap.org/contracts/v4/concepts/hooks)
- [Building Your First Hook](https://docs.uniswap.org/contracts/v4/guides/hooks/your-first-hook)
- [Uniswap v4 Deployments](https://docs.uniswap.org/contracts/v4/deployments)
- [Hook Data Standards](https://uniswapfoundation.mirror.xyz/KGKMZ2Gbc_I8IqySVUMrEenZxPnVnH9-Qe4BlN1qn0g)
- [World ID Contracts Reference](https://docs.world.org/world-id/reference/contracts)

### GitHub Repositories

- [Uniswap v4-template](https://github.com/uniswapfoundation/v4-template) - Official starter template
- [Uniswap v4-core](https://github.com/Uniswap/v4-core) - Core contracts
- [Awesome Uniswap Hooks](https://github.com/fewwwww/awesome-uniswap-hooks) - Curated examples
- [World ID Starter](https://github.com/worldcoin/world-id-starter) - Foundry starter for World ID
- [World ID Contracts](https://github.com/worldcoin/world-id-contracts) - World ID protocol contracts

### Tutorials & Guides

- [QuickNode: How to Create Uniswap V4 Hooks](https://www.quicknode.com/guides/defi/dexs/how-to-create-uniswap-v4-hooks)
- [Hacken: Auditing Uniswap V4 Hooks](https://hacken.io/discover/auditing-uniswap-v4-hooks/)
- [Cyfrin: Uniswap V4 Swap Deep Dive](https://www.cyfrin.io/blog/uniswap-v4-swap-deep-dive-into-execution-and-accounting)

### Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| PoolManager | Base | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PoolManager | Ethereum | `0x000000000004444c5dc75cb358380d2e3de08a90` |
| USDT | Base | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` |
| World ID Router | Optimism | See [World ID docs](https://docs.world.org/world-id/reference/contracts) |

---

## Next Steps (Build Order)

With decisions confirmed, here's the implementation order:

### Phase 1: Project Setup ✅
- [x] Create directory structure
- [x] Initialize Foundry project
- [x] Install dependencies (v4-core, v4-periphery, OpenZeppelin)
- [x] Configure foundry.toml and remappings

### Phase 2: Core Contracts ✅
- [x] `src/libraries/RemitTypes.sol` - Data structures and events
- [x] `src/interfaces/ICompliance.sol` - Compliance interface
- [x] `src/interfaces/IPhoneNumberResolver.sol` - Phone resolver interface
- [x] `src/interfaces/IRemitSwapHook.sol` - Hook interface
- [x] `src/compliance/AllowlistCompliance.sol` - Allowlist implementation
- [x] `src/compliance/PhoneNumberResolver.sol` - Phone-to-address mapping
- [x] `src/RemitSwapHook.sol` - Main hook contract

### Phase 3: Testing ✅
- [x] `test/utils/HookTest.sol` - Base test utilities
- [x] `test/RemitSwapHook.t.sol` - Hook tests (45 tests)
- [x] `test/Compliance.t.sol` - Compliance tests (37 tests)
- [x] `test/PhoneResolver.t.sol` - Phone resolver tests (34 tests)
- [x] `test/Integration.t.sol` - Full flow tests (21 tests)
- [x] `test/WorldcoinCompliance.t.sol` - World ID compliance tests (41 tests)
- [x] `test/Invariants.t.sol` - Invariant tests with handler (4 invariants)
- [x] `test/handlers/RemitHandler.sol` - Handler for invariant testing
- [x] `test/mocks/MockWorldID.sol` - Mock World ID for testing

**Total: 182 tests passing**

### Phase 4: Deployment ✅
- [x] `script/Deploy.s.sol` - Main deployment script (supports AllowlistCompliance + WorldcoinCompliance)
- [x] `script/SetupDemo.s.sol` - Demo data setup + utility scripts
- [ ] Deploy to Base Sepolia testnet
- [ ] Verify contracts

### Phase 5: WorldcoinCompliance ✅
- [x] `src/interfaces/IWorldID.sol` - World ID verification interface
- [x] `src/compliance/WorldcoinCompliance.sol` - World ID compliance module
- [x] Deploy script updated with `COMPLIANCE_TYPE` env variable support
- [ ] Integrate with live World ID Router (requires Optimism bridge or native deployment)

### Phase 6: Documentation
- [ ] Create demo video script
- [ ] Prepare UHI8 presentation

**Status: Phases 1-5 code complete! Ready for testnet deployment.**
