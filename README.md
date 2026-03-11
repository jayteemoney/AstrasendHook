# AstraSendHook

A Uniswap v4 hook enabling low-cost, compliant cross-border remittances with group funding capabilities.

## Overview

AstraSendHook solves the high-cost problem of cross-border remittances (averaging 6.2% globally) by leveraging Uniswap v4's hook architecture to provide:

- **< 1% total fees** vs 6-15% traditional services
- **On-chain compliance** via allowlist or Worldcoin World ID
- **Group contributions** - multiple senders can pool funds for one recipient
- **USDT corridor** - stable, global transfers
- **Instant settlement** - blockchain speed, not days

## Features

### Core Functionality
- **Remittance Creation** - Create remittances with target amounts and optional expiry
- **Group Funding** - Multiple contributors can fund a single remittance
- **Auto-Release** - Automatic release when target is met (configurable)
- **Manual Release** - Recipients can claim when ready
- **Cancellation & Refunds** - Creators can cancel with full contributor refunds
- **Expiry Handling** - Contributors can claim refunds after expiry

### Compliance (Pluggable Modules)

**Phase 1 - AllowlistCompliance**
- Allowlist-based KYC for verified users
- Configurable per-user daily transfer limits (default 10,000 USDT)
- Blocklist for sanctions compliance
- Batch operations for efficient onboarding

**Phase 2 - WorldcoinCompliance**
- World ID biometric verification (Orb-level proof of personhood)
- Zero-knowledge proof verification on-chain
- Nullifier tracking to prevent double-registration
- Same daily limit framework as Phase 1
- Admin revocation capability

Both modules implement `ICompliance` and can be hot-swapped via `setCompliance()`.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      AstraSendHook.sol                       │
│                    (Main Hook Contract)                      │
├──────────────────────────────────────────────────────────────┤
│  - beforeSwap()     → Compliance verification                │
│  - afterSwap()      → Escrow deposit + tracking              │
│  - createRemittance() → Initialize new remittance            │
│  - releaseRemittance() → Recipient claims funds              │
│  - cancelRemittance()  → Creator cancels + refunds           │
│  - contributeDirectly() → Direct contribution (no swap)      │
└──────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ICompliance.sol  │ │ RemitTypes.sol   │ │ PhoneResolver    │
│   (Interface)    │ │  (Lib/Types)     │ │     .sol         │
└──────────────────┘ └──────────────────┘ └──────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌─────────────┐
│Allowlist │ │ Worldcoin   │
│Compl.sol│ │ Compl.sol   │
└─────────┘ └─────────────┘
                  │
                  ▼
            ┌───────────┐
            │ IWorldID  │
            │(interface)│
            └───────────┘
```

## Installation

```bash
# Clone the repository
git clone https://github.com/jayteemoney/Astrasendhook.git
cd Astrasendhook

# Install dependencies
forge install

# Build
forge build

# Test
forge test
```

## Usage

### Creating a Remittance

```solidity
// Create a remittance for 1000 USDT with auto-release enabled
uint256 remittanceId = hook.createRemittance(
    recipientAddress,    // Recipient wallet
    1000 * 1e6,         // Target amount (1000 USDT)
    0,                   // No expiry (0 = never expires)
    bytes32(0),          // Purpose hash (optional)
    true                 // Auto-release when target met
);
```

### Contributing to a Remittance

```solidity
// Approve USDT spending first
usdt.approve(address(hook), amount);

// Contribute directly
hook.contributeDirectly(remittanceId, 100 * 1e6); // Contribute 100 USDT
```

### Releasing Funds (Manual)

```solidity
// Only recipient can release (if auto-release is disabled)
hook.releaseRemittance(remittanceId);
```

### Cancelling a Remittance

```solidity
// Only creator can cancel - all contributors are refunded
hook.cancelRemittance(remittanceId);
```

## Deployment

### Using AllowlistCompliance (default)

```bash
PRIVATE_KEY=0x... FEE_COLLECTOR=0x... forge script script/Deploy.s.sol:DeployAstraSendHook \
  --rpc-url base-sepolia --broadcast
```

### Using WorldcoinCompliance

```bash
PRIVATE_KEY=0x... FEE_COLLECTOR=0x... COMPLIANCE_TYPE=worldcoin \
  WORLD_ID_ROUTER=0x... WORLD_APP_ID=astrasend \
  forge script script/Deploy.s.sol:DeployAstraSendHook \
  --rpc-url base-sepolia --broadcast
```

### Demo Setup

```bash
PRIVATE_KEY=0x... HOOK_ADDRESS=0x... COMPLIANCE_ADDRESS=0x... \
  forge script script/SetupDemo.s.sol:SetupDemo --rpc-url base-sepolia --broadcast
```

## Contract Addresses

### Base Sepolia (Testnet)
| Contract | Address |
|----------|---------|
| AstraSendHook | `0x90C4eDCF58d203d924C5cAdd8c8A07bc01e798e4` |
| OpenCompliance | `0xAC4038cD8EF3Bf8a37b4D910A6007A56167226AE` |
| PhoneNumberResolver | `0x7A4C3e1Cc3b7F70E2f7BeF4bf343270c17643544` |
| Mock USDT | `0x778b10BA47EbFFA50a9368fB72b39Aa55B21C00E` |

### Unichain Sepolia (Testnet)
| Contract | Address |
|----------|---------|
| AstraSendHook | `0xbC37002Ad169c6f3b39319eECAd65a7364eEd8e4` |
| OpenCompliance | `0x61583daD9B340FF50eb6CcA6232Da15B0850946F` |
| PhoneNumberResolver | `0x012D911Dbc11232472A6AAF6b51E29A0C5929cC5` |
| Mock USDT | `0x6F491FaBdEc72fD14e9E014f50B2ffF61C508bf1` |

### Base Mainnet
| Contract | Address |
|----------|---------|
| AstraSendHook | `TBD` |
| Compliance | `TBD` |

## Testing

```bash
# Run all tests (182 tests)
forge test

# Run with verbosity
forge test -vvv

# Run specific test suite
forge test --match-contract AstraSendHookTest
forge test --match-contract WorldcoinComplianceTest
forge test --match-contract InvariantTest

# Fuzz tests only
forge test --match-test testFuzz

# Gas report
forge test --gas-report
```

### Test Results

| Test Suite | Tests | Description |
|------------|-------|-------------|
| AstraSendHookTest | 45 | Core hook functionality, error cases, fuzz tests |
| ComplianceTest | 37 | AllowlistCompliance: allowlist, blocklist, daily limits |
| PhoneResolverTest | 34 | Phone registration, resolution, batch operations |
| IntegrationTest | 21 | Full end-to-end remittance flows, stress tests |
| WorldcoinComplianceTest | 41 | World ID verification, compliance, daily limits |
| InvariantTest | 4 | Invariant properties across random operations |
| **Total** | **182** | **All passing** |

### Invariant Properties Verified
- Hook token balance >= sum of active remittance amounts
- Released remittances are immutable (status cannot change)
- Cancelled remittances have zero contribution balances
- Ghost accounting: total in = total out + total held

## Security Considerations

| Vector | Mitigation |
|--------|------------|
| Reentrancy | OpenZeppelin ReentrancyGuard on state-changing functions |
| Compliance Bypass | beforeSwap check enforced by PoolManager |
| Stuck Funds | Expiry mechanism + cancellation refunds |
| Front-running | No MEV opportunity - fixed fee, no price impact |
| Double Verification | Nullifier hash tracking (WorldcoinCompliance) |
| Integer Overflow | Solidity 0.8+ checked arithmetic |

## Fee Structure

- **Platform Fee**: 0.5% (50 basis points)
- **Maximum Fee**: 5% (500 basis points)
- Fees are deducted on release and sent to the fee collector
- Owner-adjustable within maximum cap

## Development

### Tech Stack
- **Solidity**: 0.8.26 (Cancun EVM)
- **Framework**: Foundry (via_ir, 1M optimizer runs)
- **Dependencies**: Uniswap v4-core, v4-periphery, OpenZeppelin

### Directory Structure
```
Astrasendhook/
├── src/
│   ├── AstraSendHook.sol              # Main hook contract
│   ├── compliance/
│   │   ├── OpenCompliance.sol         # Testnet: permissionless + blocklist + daily limits
│   │   ├── AllowlistCompliance.sol    # Phase 1: Allowlist KYC
│   │   ├── WorldcoinCompliance.sol    # Phase 2: World ID verification
│   │   └── PhoneNumberResolver.sol    # Phone-to-address mapping (on-chain registry)
│   ├── interfaces/
│   │   ├── ICompliance.sol            # Compliance interface
│   │   ├── IPhoneNumberResolver.sol   # Phone resolver interface
│   │   ├── IAstraSendHook.sol         # Hook interface
│   │   └── IWorldID.sol               # World ID interface
│   └── libraries/
│       └── RemitTypes.sol             # Shared types and events
├── frontend/                          # Next.js 15 app
│   └── src/
│       ├── app/                       # Pages: /, /send, /receive, /dashboard, /history
│       ├── components/                # UI components + AI assistant
│       ├── hooks/                     # wagmi contract hooks
│       └── config/contracts.ts        # ABIs + deployed addresses
├── test/
│   ├── AstraSendHook.t.sol            # Hook tests
│   ├── OpenCompliance.t.sol           # OpenCompliance tests
│   ├── WorldcoinCompliance.t.sol      # WorldcoinCompliance tests
│   ├── Integration.t.sol              # End-to-end tests
│   ├── Invariants.t.sol               # Invariant tests
│   ├── handlers/RemitHandler.sol      # Invariant handler
│   └── utils/HookTest.sol             # Base test utilities
└── script/
    ├── Deploy.s.sol                   # Deployment (testnet + mainnet, all compliance types)
    └── SetupDemo.s.sol                # Demo setup utilities
```

## Roadmap

- [x] Phase 1: Project Setup
- [x] Phase 2: Core Contracts
- [x] Phase 3: Testing
- [x] Phase 4: Deployment Scripts
- [x] Phase 5: WorldcoinCompliance
- [x] Phase 6: Testnet Deployment (Base Sepolia + Unichain Sepolia)
- [x] Phase 7: Frontend (Next.js, wagmi, AI assistant, real-time events)
- [ ] Phase 8: Mainnet Deployment (Base + Unichain)
- [ ] Phase 9: Subgraph / Analytics

## Contributing

Contributions are welcome! Please open an issue or submit a PR.

## License

MIT

## Acknowledgments

- [Uniswap Foundation](https://uniswap.org/) - v4 Hook architecture
- [Uniswap Hook Incubator](https://atrium.academy/uniswap) - UHI8 January 2026 Cohort
- [OpenZeppelin](https://openzeppelin.com/) - Security utilities
- [Worldcoin](https://worldcoin.org/) - World ID proof of personhood

---

**Built for UHI8 - Uniswap Hook Incubator January 2026 Cohort**
