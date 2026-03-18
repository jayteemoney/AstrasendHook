# AstraSend — Uniswap v4 Hook Incubator Submission (UHI8)

> **Low-cost, compliant, group-funded cross-border remittances — powered by Uniswap v4 hooks on Base and Unichain.**

---

## The Problem

Remittances are one of the most important financial flows in the world. In 2023, over **$860 billion** was sent across borders by migrant workers supporting families at home. Yet the average global fee remains **6.2%** (World Bank, Q4 2023) — meaning for every $100 sent, only $93.80 arrives. On corridors like US→Nigeria or US→Philippines, fees can hit **10–15%**.

Beyond fees, the current system imposes:
- **1–5 business day settlement** through correspondent banking
- **Business-hours-only** availability
- **$50–$100 minimum sends** that exclude the smallest and most critical transfers
- **No group funding** — a family cannot collectively send money for a loved one's tuition or medical bill
- **Opaque FX markups** hidden in mid-market rate spreads
- **Bureaucratic KYC** that excludes unbanked recipients

AstraSend attacks every one of these pain points using Uniswap v4's hook architecture.

---

## The Solution

AstraSend is a **Uniswap v4 hook** that transforms any USDT/X liquidity pool into a **compliant remittance corridor**. Senders contribute to on-chain escrow contracts — either directly or passively through Uniswap swaps — and recipients receive funds automatically when the target is met.

**Key capabilities:**

| Capability | How it works |
|---|---|
| **< 1% total fee** | 0.5% platform fee + sub-cent gas on Base/Unichain L2 |
| **~2s settlement on Base, ~200ms on Unichain** | L2 finality, no correspondent banking |
| **Group contributions** | Multiple senders pool toward one remittance |
| **Phone-based sends** | Send to a phone number — no wallet address needed |
| **Auto-release escrow** | Funds released automatically when target is met |
| **On-chain compliance** | Pluggable KYC/AML modules — no bureaucratic paperwork |
| **Expiry & refunds** | Trustless, instant refunds if target not met |
| **24/7 availability** | Blockchain has no business hours |

---

## Why Uniswap v4 Hooks?

AstraSend uses v4's hook architecture in a way that is **impossible to build on v3 or any prior DEX version**:

1. **`afterSwapReturnDelta`** — The hook intercepts swap *output* before it reaches the swapper, redirecting USDT into the escrow. This is the financial primitive that makes "contribute via swap" possible without any wrapper contract.

2. **`beforeSwap`** — Validates compliance and caches the remittance ID in EIP-1153 transient storage, passing context to `afterSwap` with zero cold storage reads.

3. **`beforeAddLiquidity`** — Compliance-gates liquidity provision so only verified participants can provide liquidity to regulated remittance corridors.

4. **`beforeDonate`** — Routes Uniswap v4 pool donations directly to active remittance escrows, enabling a completely new "donate-to-remit" flow.

5. **`afterInitialize`** — Registers each new pool as a USDT corridor and validates it contains the supported token.

No existing remittance protocol uses DeFi liquidity this directly. **AstraSend doesn't just sit beside a DEX — it is the DEX.** Every swap on a registered pool can be a remittance contribution.

---

## Hook Architecture Summary

```
Sender Wallet
     │
     ▼
Uniswap v4 PoolManager
     │
     ├── beforeSwap ──────► Compliance check + tstore(remittanceId)
     │
     ├── afterSwap ───────► tload(remittanceId) → take(USDT) → escrow
     │                      ↑ afterSwapReturnDelta captures output
     ├── beforeAddLiquidity ► Compliance gate for LPs
     │
     ├── afterInitialize ──► Register pool as USDT corridor
     │
     └── beforeDonate ────► Route donations to active remittance
```

---

## Deployed Contracts

### Base Sepolia (Chain ID: 84532)

| Contract | Address |
|---|---|
| AstraSendHook | `0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4` |
| OpenCompliance | `0xa15d7d5505BC3D7B74A27808141D86752EfE09b6` |
| PhoneNumberResolver | `0x29f47d33B73712000f554FAB4119eE6ce0741Dea` |
| USDT (MockUSDT) | `0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA` |

### Unichain Sepolia (Chain ID: 1301)

| Contract | Address |
|---|---|
| AstraSendHook | `0x31c76772ad6A821F0908AC3c6Caa706a043A98E4` |
| OpenCompliance | `0xBfBD571aCA171167833355e944c5CC8E96FE8A16` |
| PhoneNumberResolver | `0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA` |
| USDT (MockUSDT) | `0x3E4e5a1Fb92f70dB37019F3E813C79341ede37E6` |

---

## Live Demo

Frontend: deployed on Base Sepolia + Unichain Sepolia testnets.

- Connect wallet → create a remittance → share the ID → friends contribute → recipient auto-receives.
- Register a phone number → anyone can send to your `+` number without knowing your wallet address.

---

## Test Coverage

229 passing tests covering:
- Unit tests for all remittance lifecycle operations
- Integration tests for hook paths (afterInitialize, beforeAddLiquidity, beforeSwap/afterSwap, beforeDonate)
- Invariant tests (solvency, contribution accounting)
- Fuzz tests (contribution amounts, expiry timestamps, contributor counts)

---

## Repository Structure

```
AstrasendHook/
├── src/
│   ├── AstraSendHook.sol           # Main hook contract
│   ├── compliance/
│   │   ├── OpenCompliance.sol      # Testnet: permissionless + blocklist
│   │   ├── AllowlistCompliance.sol # Phase 1: KYC allowlist
│   │   ├── WorldcoinCompliance.sol # Phase 2: World ID biometric
│   │   └── PhoneNumberResolver.sol # Phone hash → wallet mapping
│   ├── interfaces/                 # ICompliance, IAstraSendHook, etc.
│   └── libraries/RemitTypes.sol    # Shared structs, events, enums
├── test/                           # 229 tests
├── script/                         # Deployment scripts
├── frontend/                       # Next.js 16 + wagmi v3 + connectkit
└── docs/                           # This documentation
```

---

## Documentation Index

- [Architecture](./architecture.md) — System design and contract relationships
- [Hook Design](./hook-design.md) — Deep dive into every v4 hook point used
- [Compliance System](./compliance.md) — Pluggable compliance modules
- [Ecosystem Impact](./ecosystem-impact.md) — Why this matters for DeFi and the world
- [Deployment Guide](./deployment.md) — How to deploy and configure
