# Compliance System — AstraSend

---

## Overview

AstraSend implements a **pluggable, modular compliance architecture**. The hook interacts with compliance exclusively through the `ICompliance` interface, which means:

1. Compliance modules can be **swapped without redeploying the hook**
2. The same hook can serve different regulatory environments (open testnet, KYC-gated, biometric-verified)
3. Third-party compliance providers can plug in by implementing the interface

---

## The ICompliance Interface

```solidity
interface ICompliance {
    /// @notice Check if a transfer is compliant
    /// @param sender Address initiating the transfer
    /// @param recipient Destination address
    /// @param amount Transfer amount in USDT (6 decimals)
    /// @return bool True if the transfer is allowed
    function isCompliant(address sender, address recipient, uint256 amount)
        external view returns (bool);

    /// @notice Get detailed compliance status for a UI
    /// @return isAllowed Whether the account is allowed to transact
    /// @return dailyUsed Amount used today (resets at UTC midnight)
    /// @return dailyLimit Maximum allowed per day
    function getComplianceStatus(address account)
        external view returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit);

    /// @notice Remaining daily capacity
    function getRemainingDailyLimit(address account) external view returns (uint256);

    /// @notice Check if an address is explicitly blocked
    function isBlocked(address account) external view returns (bool);

    /// @notice Record usage after a successful contribution (called by hook)
    function recordUsage(address account, uint256 amount) external;
}
```

All three compliance modules implement this interface identically from the hook's perspective. Switching compliance modules is a single owner transaction:

```solidity
astraSendHook.setCompliance(newComplianceAddress);
```

---

## Module 1: OpenCompliance (Testnet)

**Use case:** Open pilots, testnet, hackathon demos.

**Logic:**
- Any address is allowed by default (permissionless)
- Maintains a `blocklist` mapping — explicitly blocked addresses return `isAllowed = false`
- Per-address daily limits (configurable by admin, defaults to `defaultDailyLimit`)
- Daily usage tracked in a `dailyUsage[account][day]` mapping where `day = block.timestamp / 86400`

**`isCompliant` logic:**
```
isCompliant(sender, recipient, amount) = true if:
  - sender not on blocklist
  - recipient not on blocklist
  - amount >= minimumAmount
  - sender's dailyUsed + amount <= dailyLimit
```

**Admin role system:**
- `owner` — set default limits, minimum amount, hook address, add/remove admins
- `admin` — manage blocklist entries

**Deployed at:**
- Base Sepolia: `0xAC4038cD8EF3Bf8a37b4D910A6007A56167226AE`
- Unichain Sepolia: `0x61583daD9B340FF50eb6CcA6232Da15B0850946F`

---

## Module 2: AllowlistCompliance (Phase 1 / Mainnet)

**Use case:** Regulated deployment where all participants must complete off-chain KYC before using the protocol.

**Logic:**
- Addresses are **denied by default** — only explicitly allowlisted addresses may transact
- Admin adds addresses to the allowlist after off-chain KYC verification
- Maintains the same daily limit and blocklist infrastructure as OpenCompliance
- Allows batch-registration for onboarding events

**`isCompliant` logic:**
```
isCompliant(sender, recipient, amount) = true if:
  - sender on allowlist
  - recipient on allowlist
  - neither on blocklist
  - amount >= minimumAmount
  - sender's dailyUsed + amount <= dailyLimit
```

**Typical deployment flow:**
1. Users complete KYC via a partner (off-chain)
2. KYC provider calls `batchAllow([address1, address2, ...])` on AllowlistCompliance
3. Users can now transact; hook validates on-chain without calling the KYC provider

---

## Module 3: WorldcoinCompliance (Phase 2)

**Use case:** Production deployment with maximum sybil resistance. Requires Worldcoin World ID iris-scan proof.

**Why World ID?**

Daily sending limits are a core AML/CFT tool. But address-based limits are trivially bypassed — one person can create 10 wallets and transfer 10× their daily limit. World ID solves this by linking each wallet to a unique verified human. Each iris scan produces a unique nullifier, so one person can verify at most one wallet per app.

**Integration:**
```solidity
IWorldID worldId;
uint256 externalNullifierHash;  // specific to AstraSend's app ID

function verify(
    address signal,           // the wallet address being verified
    uint256 root,             // World ID tree root
    uint256 nullifierHash,    // unique per-person per-app
    uint256[8] calldata proof // ZK proof
) external {
    worldId.verifyProof(root, groupId, signal, nullifierHash,
        externalNullifierHash, proof);
    verified[signal] = true;
    nullifierHashes[nullifierHash] = true;
}
```

The ZK proof guarantees:
1. The user scanned their iris with the Worldcoin orb
2. This iris has not been used to verify another wallet for this app
3. No biometric data is ever on-chain — only the nullifier hash

**`isCompliant` with World ID:**
```
isCompliant(sender, recipient, amount) = true if:
  - sender has verified World ID proof
  - recipient has verified World ID proof (or is whitelisted)
  - neither on blocklist
  - amount >= minimumAmount
  - sender's dailyUsed + amount <= dailyLimit
```

**Status:** Contract fully implemented and tested. Awaiting mainnet deployment (requires World ID Router contract on target chain).

---

## Daily Limit System

All three compliance modules track daily usage identically:

```
day = block.timestamp / 86400  (UTC day number)

dailyUsed[account][day] += amount  (on recordUsage call)

remainingLimit = dailyLimit - dailyUsed[account][currentDay]
```

The day-based reset means:
- Limits automatically reset at UTC midnight
- No cron job or manual reset needed
- Historical usage is preserved (can audit past days)

**Default daily limit:** 10,000 USDT (configurable by owner)

**Per-account overrides:** Admins can set custom limits for high-volume users (`updateDailyLimit(account, newLimit)`).

---

## Compliance and the Hook

The hook calls compliance in three places:

| Hook Point | Compliance Call | Purpose |
|---|---|---|
| `createRemittance` | `isCompliant(creator, recipient, targetAmount)` | Validate creator can create this remittance |
| `beforeSwap` | `isCompliant(sender, remit.recipient, amount)` | Validate swap contribution |
| `contributeDirectly` | `isCompliant(msg.sender, remit.recipient, amount)` | Validate direct contribution |
| `beforeAddLiquidity` | `getComplianceStatus(sender)` | Validate LP (no amount to check) |
| `_recordContribution` | `recordUsage(contributor, amount)` | Update daily usage after contribution |

Notably, `releaseRemittance` does **not** call compliance — releasing already-escrowed funds is not a new transfer that needs compliance checking.

---

## Switching Compliance Modules

To upgrade from testnet OpenCompliance → Phase 1 AllowlistCompliance:

```bash
# Deploy AllowlistCompliance
forge script script/DeployAllowlist.s.sol --broadcast

# Point hook to new compliance
cast send $HOOK_ADDRESS "setCompliance(address)" $NEW_COMPLIANCE \
  --rpc-url $BASE_RPC --private-key $OWNER_KEY
```

The hook immediately uses the new compliance module for all future transactions. Existing remittances continue to completion under the rules that existed when they were created — the platform fee is locked at creation time. Whether the compliance module change affects pending contributions depends on the new module's rules.
