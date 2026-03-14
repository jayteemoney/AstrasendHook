# System Architecture — AstraSend

---

## Overview

AstraSend is a **multi-contract system** built around a central Uniswap v4 hook. The architecture separates concerns cleanly:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                     │
│   wagmi v3 · connectkit · viem · TanStack Query · React         │
└────────────────────┬────────────────────────────────────────────┘
                     │ RPC calls
┌────────────────────▼────────────────────────────────────────────┐
│                   Uniswap v4 PoolManager                         │
│              (singleton — all pools in one contract)             │
└────────────────────┬────────────────────────────────────────────┘
                     │ hook callbacks
┌────────────────────▼────────────────────────────────────────────┐
│                    AstraSendHook.sol                             │
│    ┌─────────────────────────────────────────────────────┐      │
│    │  Remittance Escrow Storage                          │      │
│    │  (remittances mapping, contributions, contributors) │      │
│    └─────────────────────────────────────────────────────┘      │
│         │                              │                         │
│         ▼                              ▼                         │
│  ICompliance interface         IPhoneNumberResolver              │
│         │                              │                         │
└─────────┼──────────────────────────────┼─────────────────────────┘
          │                              │
┌─────────▼──────────┐        ┌──────────▼──────────────┐
│  OpenCompliance    │        │  PhoneNumberResolver     │
│  (testnet)         │        │  keccak256(phone) →      │
│  ─────────────     │        │  wallet address          │
│  AllowlistComp.    │        └─────────────────────────-┘
│  (Phase 1)         │
│  ─────────────     │
│  WorldcoinComp.    │
│  (Phase 2)         │
└────────────────────┘
```

---

## Core Contracts

### AstraSendHook.sol

The central contract. Inherits from:
- `BaseHook` (v4-periphery) — provides the hook interface and PoolManager reference
- `IAstraSendHook` — the project's public interface
- `Ownable` (OpenZeppelin) — owner can configure fee, compliance, resolver
- `ReentrancyGuardTransient` (OpenZeppelin v5) — transient-storage reentrancy guard

**Responsibilities:**
- Register USDT corridor pools on initialization
- Gate liquidity provision and swaps with compliance checks
- Capture swap output into escrow via `afterSwapReturnDelta`
- Manage the full remittance lifecycle: create → fund → release/cancel/expire
- Route pool donations to active remittances

**Immutable state:**
- `SUPPORTED_TOKEN` — set at construction, never changes. Currently USDT.

**Mutable state (owner-controlled):**
- `compliance` — pluggable compliance module address
- `phoneResolver` — phone number resolver address
- `feeCollector` — where platform fees go
- `platformFeeBps` — fee in basis points (max 500 = 5%)
- `autoReleaseEnabled` — global auto-release toggle
- `donationRouting` — pool → remittanceId routing map

---

### Remittance Data Model

Each remittance is stored in a `RemittanceStorage` struct:

```solidity
struct RemittanceStorage {
    uint256 id;
    address creator;
    address recipient;
    address token;              // always USDT
    uint256 targetAmount;       // goal in USDT (6 decimals)
    uint256 currentAmount;      // amount collected so far
    uint256 platformFeeBps;     // fee locked at creation time
    uint256 createdAt;
    uint256 expiresAt;          // 0 = no expiry
    bytes32 purposeHash;        // keccak256(purpose string) or zero
    RemitTypes.Status status;   // Active | Released | Cancelled | Expired
    bool autoRelease;
    address[] contributorList;  // for refund iteration (max 50)
    mapping(address => uint256) contributions; // per-contributor amounts
}
```

**Status state machine:**

```
        create()
           │
           ▼
        Active
       /   │   \
      /    │    \
cancel() expire() target met (+ autoRelease)
     │     │              │
     ▼     ▼              ▼
Cancelled Expired      Released
                   (or manualRelease by recipient)
```

---

### ICompliance Interface

All compliance modules implement the same interface, making them hot-swappable:

```solidity
interface ICompliance {
    function isCompliant(address sender, address recipient, uint256 amount) external view returns (bool);
    function getComplianceStatus(address account) external view returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit);
    function getRemainingDailyLimit(address account) external view returns (uint256);
    function isBlocked(address account) external view returns (bool);
    function recordUsage(address account, uint256 amount) external;
}
```

The hook calls `compliance.isCompliant()` in `beforeSwap` and `createRemittance`. It calls `compliance.recordUsage()` in `_recordContribution` after every successful contribution.

---

### Compliance Modules

#### OpenCompliance (testnet)
- Permissionless — any address is allowed by default
- Maintains a `blocklist` mapping (admin-controlled)
- Per-address configurable daily limits (default 10,000 USDT)
- Ideal for testnet / open pilots

#### AllowlistCompliance (Phase 1 / mainnet)
- Requires explicit KYC approval — only allowlisted addresses may transact
- Suitable for regulated deployments where all participants must be verified
- Used in mainnet deployment scripts

#### WorldcoinCompliance (Phase 2)
- Requires a valid Worldcoin World ID iris-scan ZK proof
- Proof-of-personhood: one person = one verified identity
- Sybil-resistant — prevents one person from creating multiple accounts to circumvent daily limits
- Uses zero-knowledge proofs — no biometric data ever leaves the user's device
- Requires World ID Router contract (not available on testnets)

**Switching compliance modules** requires only an owner call: `setCompliance(newAddress)`. The hook's behavior changes immediately for all future transactions. This allows the same deployment to transition from testnet → Phase 1 → Phase 2 without redeployment.

---

### PhoneNumberResolver.sol

Maps `keccak256(phoneNumber)` → `walletAddress`. Enables phone-based sends without exposing phone numbers on-chain.

**Privacy model:**
- Phone numbers are stored as their keccak256 hash only — the plaintext is never on-chain
- Only the wallet owner can register their phone: `registerPhoneString(phone, wallet)` requires `msg.sender == wallet`
- Wallets can self-update (`updateMyWallet`) or self-remove (`unregisterMyPhone`)
- Admins can batch-register for onboarding, force-unregister for fraud, update any wallet

**Send-by-phone flow:**
```
Sender knows recipient phone: "+2348012345678"
        │
        ▼
keccak256("+2348012345678") = phoneHash
        │
        ▼
AstraSendHook.createRemittanceByPhone(phoneHash, ...)
        │
        ▼
phoneResolver.resolve(phoneHash) → recipient wallet address
        │
        ▼
Remittance created for that wallet
```

The sender never needs to know the recipient's wallet address. The recipient registers once and then anyone with their phone number can send them money.

---

## Transaction Flows

### Flow 1: Direct Send (contributeDirectly)

```
1. Sender approves USDT to AstraSendHook
2. Sender calls createRemittance(recipient, amount, ...)
   → compliance.isCompliant(sender, recipient, amount) checked
   → RemittanceStorage created, status = Active
3. Sender calls contributeDirectly(remittanceId, amount)
   → USDT transferred from sender to hook (safeTransferFrom)
   → _recordContribution() → compliance.recordUsage()
   → if target met + autoRelease: _releaseRemittance()
      → USDT transferred to recipient (minus fee)
      → fee transferred to feeCollector
```

### Flow 2: Swap Contribution (via PoolManager)

```
1. Sender calls PoolManager.swap(key, params, hookData)
   hookData = abi.encode(RemitHookData{isContribution: true, remittanceId: X})

2. PoolManager calls beforeSwap hook
   → compliance check
   → tstore(0x01, remittanceId)

3. PoolManager executes the swap (Token A → USDT)

4. PoolManager calls afterSwap hook
   → tload(0x01) → remittanceId
   → contributionAmount = delta.amount1() (USDT output, positive)
   → poolManager.take(USDT, hookAddress, contributionAmount)
   → _recordContribution()
   → return int128(contributionAmount)  ← hookDeltaUnspecified

5. PoolManager reduces swapper's USDT claim by contributionAmount
   (USDT stays in hook's escrow, not sent to swapper)
```

### Flow 3: Phone-Based Send

```
1. Recipient registers: phoneResolver.registerPhoneString("+234...", wallet)
2. Sender calls: createRemittanceByPhone(keccak256(phone), amount, ...)
   → phoneResolver.resolve(phoneHash) → recipient wallet
   → same as Flow 1 from here
```

### Flow 4: Refund (expired or cancelled)

```
Expired:
  Any contributor calls claimExpiredRefund(remittanceId)
  → checks expiresAt < block.timestamp
  → refunds contributions[msg.sender]
  → status → Expired (on first claim)

Cancelled:
  Creator calls cancelRemittance(remittanceId)
  → iterates contributorList (max 50)
  → refunds all contributors
  → status → Cancelled
```

---

## Security Properties

| Property | Mechanism |
|---|---|
| Reentrancy protection | `ReentrancyGuardTransient` on all token-moving functions |
| Self-remittance prevention | `SelfRemittance` error if creator == recipient |
| Recipient anti-fraud | `RecipientCannotContribute` — recipient can't fund their own remittance |
| Fee cap | `MAX_PLATFORM_FEE_BPS = 500` (5%) — immutable constant |
| Contributor gas-bomb prevention | `MAX_CONTRIBUTORS = 50` — bounded iteration on cancel |
| Compliance enforcement | On every contribution path (swap, direct, create) |
| Token validation | Only `SUPPORTED_TOKEN` pools can be registered |
| Platform fee locked at creation | `remit.platformFeeBps` set at create time — owner changes don't affect existing remittances |
