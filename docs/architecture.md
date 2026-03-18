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

The hook calls `compliance.isCompliant()` in `beforeSwap`, `contributeDirectly`. For `createRemittance`, it calls `compliance.getComplianceStatus(creator)` — this checks allowlist/blocklist status without applying an amount threshold, since no funds transfer at creation time. It calls `compliance.recordUsage()` in `_recordContribution` after every successful contribution.

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

## Multi-Chain Deployment & Unichain Integration

AstraSend is deployed on **two chains simultaneously** — Base Sepolia and Unichain Sepolia — with mainnet-ready addresses for both Base and Unichain. The hook contract code is **identical on both chains**. Unichain's advantages are infrastructure-level, not code-level, which means the same battle-tested contract automatically benefits from Unichain's properties.

### Why Unichain specifically

| Property | Base | Unichain |
|---|---|---|
| Block time | ~2 seconds | **~200ms (Flashblocks)** |
| MEV protection | Standard | **TEE-secured block building — sandwich attacks impossible** |
| Ecosystem | Broad, Coinbase-backed | **Uniswap-native, purpose-built for DeFi** |

**Flashblocks** matter for remittances: on Unichain the recipient sees their funds credited in ~200ms — before the sender has closed the browser tab. This qualitative difference in UX is not achievable on any other L2.

**TEE block building** matters for the swap contribution path: when a contributor swaps ETH → USDT through the AstraSend pool, they are exposed to MEV (front-running, sandwich attacks) on every other chain. Unichain's Trusted Execution Environment eliminates this — the contributor always gets the price they see in the UI.

### Frontend multi-chain wiring

Both testnets (Base Sepolia and Unichain Sepolia) are wired in the frontend. Mainnet chains are intentionally excluded — the app enforces testnet-only to prevent users from transacting on chains where contracts are not yet deployed.

**`frontend/src/config/wagmi.ts`** — chain configuration:
```typescript
import { baseSepolia, unichainSepolia } from "wagmi/chains";

chains: [baseSepolia, unichainSepolia],
transports: {
  [baseSepolia.id]:     http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL     || "https://sepolia.base.org"),
  [unichainSepolia.id]: http(process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC_URL || "https://sepolia.unichain.org"),
}
```

With `enforceSupportedChains: true` in ConnectKitProvider, users connecting with a mainnet wallet are prompted to switch to a supported testnet before any transaction is possible.

**`frontend/src/config/contracts.ts`** — per-chain contract addresses with automatic routing:
```typescript
// Base Sepolia (Chain ID: 84532)
84532: {
  astraSendHook: "0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4",
  compliance:    "0xa15d7d5505BC3D7B74A27808141D86752EfE09b6",
  phoneResolver: "0x29f47d33B73712000f554FAB4119eE6ce0741Dea",
  usdt:          "0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA",
}

// Unichain Sepolia (Chain ID: 1301)
1301: {
  astraSendHook: "0x31c76772ad6A821F0908AC3c6Caa706a043A98E4",
  compliance:    "0xBfBD571aCA171167833355e944c5CC8E96FE8A16",
  phoneResolver: "0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA",
  usdt:          "0x3E4e5a1Fb92f70dB37019F3E813C79341ede37E6",
}

// Single routing function — entire app auto-switches on chain change
export function getContracts(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[84532];
}
```

Every hook in the frontend calls `getContracts(chainId)` — when the user switches their wallet to Unichain Sepolia, every contract interaction (createRemittance, contributeDirectly, compliance checks, phone resolution) automatically targets the deployed Unichain contracts. No conditional logic anywhere else in the codebase.

**`frontend/src/lib/utils.ts`** — Unichain explorer URL:
```typescript
1301: "https://sepolia.uniscan.xyz"  // Transaction links on Unichain
```

### Chain-agnostic hook, chain-specific benefits

The `AstraSendHook.sol` contract has no chain-specific code. Deploying it on Unichain does not require any modifications. The benefits are additive:

- On **Base**: 2s settlement, broad ecosystem, Coinbase trust model
- On **Unichain**: same hook, same compliance, same escrow logic — but with 200ms Flashblocks and MEV-proof swap contributions

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
