# AstraSend — Uniswap v4 Cross-Border Remittance Hook

> Low-cost, compliant, group-funded cross-border remittances powered by Uniswap v4 hooks on Base and Unichain.
> Built for **UHI8 — Uniswap Hook Incubator, January 2026 Cohort**.

**[Live App](https://astrasend1.vercel.app/) · [Demo Video](https://www.loom.com/share/2e228f7021db405baf4e2f05e95e20fe)**

---

## Partner Integrations

| Partner | Integration |
|---|---|
| [Uniswap v4](https://uniswap.org/) | Core hook infrastructure — all 6 hook points, `afterSwapReturnDelta`, flash accounting |
| [Uniswap Hook Incubator](https://atrium.academy/uniswap) | UHI8 January 2026 Cohort |
| [Base](https://base.org/) | Primary L2 deployment — ~2s settlement, sub-cent gas, broad ecosystem |
| [Unichain](https://unichain.org/) | Secondary L2 deployment — 200ms Flashblocks settlement, TEE-secured block building (MEV-proof swap contributions) |
| [Worldcoin / World ID](https://worldcoin.org/) | Phase 2 compliance module — biometric proof-of-personhood, ZK iris scan, sybil-resistant daily limits. Contract complete and tested; activates when World ID Router is live on Base/Unichain. |
| [OpenZeppelin v5](https://openzeppelin.com/) | `Ownable`, `SafeERC20`, `ReentrancyGuardTransient` security primitives |

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
| AI assistant | Built-in contextual assistant on every page — powered by Qwen 2.5 72B |

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
│   ├── Deploy.s.sol                # Full deployment (all chains + testnet convenience contracts)
│   ├── DeployOpenCompliance.s.sol  # Deploy OpenCompliance standalone
│   ├── DeployPhoneResolver.s.sol   # Deploy PhoneNumberResolver standalone
│   └── FixCompliance.s.sol         # Switch deployed hook to OpenCompliance post-deploy
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

**Built-in AI Assistant** — A context-aware AI assistant (Qwen/Qwen2.5-72B-Instruct via Hugging Face) is embedded on every page of the frontend. It knows which chain the user is connected to, their wallet status, and which page they are on. It can answer questions about fees, how to send, the swap contribution mechanic, the compliance roadmap, and any AstraSend feature — in plain language accessible to non-crypto users. Responses stream in real time. This is a deliberate product decision: remittances serve people who are not DeFi-native, and the assistant bridges that gap without requiring them to read documentation.

---

## Tech Stack

- **Solidity** 0.8.26 (Cancun EVM, `via_ir`, 1M optimizer runs)
- **Foundry** — build, test, deploy
- **Uniswap v4-core + v4-periphery**
- **OpenZeppelin v5** (Ownable, SafeERC20, ReentrancyGuardTransient)
- **Frontend**: Next.js 16, wagmi v3, connectkit, viem, TanStack Query, Tailwind CSS v4
- **AI Assistant**: Qwen/Qwen2.5-72B-Instruct via Hugging Face inference API (streaming, context-aware)

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
