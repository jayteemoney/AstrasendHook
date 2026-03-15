# AstraSend — Uniswap v4 Cross-Border Remittance Hook

> Low-cost, compliant, group-funded cross-border remittances powered by Uniswap v4 hooks on Base and Unichain.
> Built for **UHI8 — Uniswap Hook Incubator, January 2026 Cohort**.

---

## What It Does

AstraSendHook transforms any USDT liquidity pool on Uniswap v4 into a **compliant remittance corridor**. Senders create escrow remittances, contributors fund them (directly or via swaps), and recipients receive USDT automatically when the target is met — all on-chain, all trustless.

| Metric | Value |
|---|---|
| Total fee | < 1% (0.5% platform + sub-cent gas) |
| Settlement | ~2s on Base, ~200ms on Unichain Flashblocks |
| Group funding | Multiple senders pool toward one recipient |
| Phone sends | Send to `+countrycode...` — no wallet address needed |
| Compliance | Pluggable: OpenCompliance / AllowlistCompliance / World ID |

---

## Architecture

```
Sender → Uniswap v4 PoolManager
              │
              ├── afterInitialize       → Register pool as USDT corridor
              ├── beforeAddLiquidity    → Compliance-gate LP provision
              ├── beforeSwap            → Compliance check
              ├── afterSwap             → Capture USDT output into escrow
              ├── afterSwapReturnDelta  → Reduce swapper's output by escrowed amount
              └── beforeDonate          → Route pool donations to active remittances

AstraSendHook ──► ICompliance (OpenCompliance | AllowlistCompliance | WorldcoinCompliance)
             ──► IPhoneNumberResolver (keccak256(phone) → wallet)
```

---

## Quick Start

```bash
git clone https://github.com/jayteemoney/AstrasendHook
cd AstrasendHook
forge install
forge build
forge test          # 229 tests, all passing
```

---

## Deployed Contracts

### Base Sepolia (Chain ID: 84532)
| Contract | Address |
|---|---|
| AstraSendHook | `0x90C4eDCF58d203d924C5cAdd8c8A07bc01e798e4` |
| OpenCompliance | `0xAC4038cD8EF3Bf8a37b4D910A6007A56167226AE` |
| PhoneNumberResolver | `0x7A4C3e1Cc3b7F70E2f7BeF4bf343270c17643544` |
| USDT (test) | `0x778b10BA47EbFFA50a9368fB72b39Aa55B21C00E` |

### Unichain Sepolia (Chain ID: 1301)
| Contract | Address |
|---|---|
| AstraSendHook | `0xbC37002Ad169c6f3b39319eECAd65a7364eEd8e4` |
| OpenCompliance | `0x61583daD9B340FF50eb6CcA6232Da15B0850946F` |
| PhoneNumberResolver | `0x012D911Dbc11232472A6AAF6b51E29A0C5929cC5` |
| USDT (test) | `0x6F491FaBdEc72fD14e9E014f50B2ffF61C508bf1` |

---

## Test Coverage

```bash
forge test --summary
```

| Test Suite | Tests | Coverage |
|---|---|---|
| AstraSendHookTest | 51 | Core lifecycle: create, contribute, release, cancel, expire, refund, fuzz |
| HookSwapPathTest | 21 | All 4 hook paths via PoolManager: afterInitialize, beforeAddLiquidity, beforeSwap/afterSwap, beforeDonate |
| OpenComplianceTest | 20 | Blocklist, daily limits, recordUsage, admin roles |
| PhoneResolverTest | 34 | Registration, resolution, self-update, batch ops, admin |
| WorldcoinComplianceTest | 41 | World ID verification, ZK proof validation, daily limits |
| InvariantTest | 4 | Solvency: hook balance ≥ active remittance totals |
| IntegrationTest + Fuzz | 58 | End-to-end flows, fuzz amounts/expiry/contributors |
| **Total** | **229** | **All passing** |

---

## Repository Structure

```
AstrasendHook/
├── src/
│   ├── AstraSendHook.sol           # Main hook (6 hook points, escrow, lifecycle)
│   ├── compliance/
│   │   ├── OpenCompliance.sol      # Testnet: permissionless + blocklist + daily limits
│   │   ├── AllowlistCompliance.sol # Phase 1: KYC allowlist
│   │   ├── WorldcoinCompliance.sol # Phase 2: World ID biometric ZK proof
│   │   └── PhoneNumberResolver.sol # keccak256(phone) → wallet mapping
│   ├── interfaces/
│   │   ├── ICompliance.sol
│   │   ├── IPhoneNumberResolver.sol
│   │   ├── IAstraSendHook.sol
│   │   └── IWorldID.sol
│   └── libraries/
│       └── RemitTypes.sol          # Structs, enums, events
├── test/
│   ├── AstraSendHook.t.sol
│   ├── HookSwapPath.t.sol          # Hook path integration tests
│   ├── OpenCompliance.t.sol
│   ├── WorldcoinCompliance.t.sol
│   ├── Integration.t.sol
│   ├── Invariants.t.sol
│   ├── handlers/RemitHandler.sol
│   └── utils/HookTest.sol
├── script/
│   ├── Deploy.s.sol
│   └── SetupDemo.s.sol
├── frontend/                       # Next.js 16 + wagmi v3 + connectkit + viem
└── docs/                           # Full documentation
    ├── README.md                   # Submission overview (UHI8 judges)
    ├── architecture.md             # System design + contract relationships
    ├── hook-design.md              # Deep dive on all 6 hook points
    ├── compliance.md               # Compliance modules documentation
    ├── ecosystem-impact.md         # Ecosystem impact narrative
    ├── deployment.md               # Deploy guide + testnet addresses
    ├── frontend.md                 # Frontend setup and structure
    ├── user-guide.md               # End-user guide
    └── contributing.md             # Contribution guidelines
```

---

## Key Technical Highlights

**`afterSwapReturnDelta`** — The hook intercepts swap output before it reaches the swapper, redirecting USDT directly into escrow. This is only possible in Uniswap v4 and requires no wrapper contract or extra transaction.

**`beforeSwap` compliance** — Every swap with contribution intent is checked against the on-chain compliance module before execution. Non-compliant swaps never execute.

**Pluggable compliance** — `setCompliance(newAddress)` hot-swaps the compliance module without redeploying the hook. Three modules cover testnet → Phase 1 → Phase 2 production.

**Phone-to-wallet resolution** — `keccak256(phoneNumber)` stored on-chain; senders resolve it without the recipient ever sharing their wallet address.

---

## Tech Stack

- **Solidity** 0.8.26 (Cancun EVM, `via_ir`, 1M optimizer runs)
- **Foundry** — build, test, deploy
- **Uniswap v4-core + v4-periphery**
- **OpenZeppelin v5** (Ownable, SafeERC20, ReentrancyGuardTransient)
- **Frontend**: Next.js 16, wagmi v3, connectkit, viem, TanStack Query, Tailwind CSS v4

---

## Documentation

Full documentation is in [`/docs`](./docs/):

- [Submission Overview](./docs/README.md)
- [Architecture](./docs/architecture.md)
- [Hook Design](./docs/hook-design.md)
- [Compliance System](./docs/compliance.md)
- [Ecosystem Impact](./docs/ecosystem-impact.md)
- [Deployment Guide](./docs/deployment.md)
- [Frontend Guide](./docs/frontend.md)
- [User Guide](./docs/user-guide.md)

---

## License

MIT

## Acknowledgments

- [Uniswap Foundation](https://uniswap.org/) — v4 hook architecture
- [Uniswap Hook Incubator](https://atrium.academy/uniswap) — UHI8 January 2026 Cohort
- [OpenZeppelin](https://openzeppelin.com/) — security utilities
- [Worldcoin](https://worldcoin.org/) — World ID proof of personhood
- [Base](https://base.org/) — L2 settlement layer
- [Unichain](https://unichain.org/) — MEV-protected Flashblocks settlement
