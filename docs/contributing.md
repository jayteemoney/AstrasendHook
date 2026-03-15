# Contributing — AstraSend

## What is this?

A Uniswap v4 hook for cross-border remittances. Built with Foundry, Solidity 0.8.26, targeting Base and Unichain.

## Build & Test

```bash
forge build          # Compile
forge test           # Run all 229 tests
forge test -vvv      # Verbose output
forge test --gas-report   # Gas report
forge coverage       # Coverage report
```

## Project Structure

```
src/
├── AstraSendHook.sol           # Main hook (6 hook points, escrow, lifecycle)
├── compliance/
│   ├── OpenCompliance.sol      # Testnet: permissionless + blocklist + daily limits
│   ├── AllowlistCompliance.sol # Phase 1: KYC allowlist
│   ├── WorldcoinCompliance.sol # Phase 2: World ID biometric ZK proof
│   └── PhoneNumberResolver.sol # keccak256(phone) → wallet mapping
├── interfaces/
│   ├── ICompliance.sol
│   ├── IPhoneNumberResolver.sol
│   ├── IAstraSendHook.sol
│   └── IWorldID.sol
└── libraries/
    └── RemitTypes.sol          # Structs, enums, events

test/
├── AstraSendHook.t.sol         # Core lifecycle tests
├── HookSwapPath.t.sol          # Hook path integration tests (real PoolManager)
├── OpenCompliance.t.sol        # Compliance module tests
├── WorldcoinCompliance.t.sol   # World ID compliance tests
├── Integration.t.sol           # End-to-end + fuzz
├── Invariants.t.sol            # Solvency invariants
├── handlers/RemitHandler.sol   # Invariant test handler
└── utils/HookTest.sol          # Base test contract with setup helpers

script/
├── Deploy.s.sol                # Deployment (supports COMPLIANCE_TYPE=allowlist|worldcoin)
└── SetupDemo.s.sol             # Demo setup
```

## Key Patterns

- Hook address must encode permissions in lowest bits — uses `HookMiner.find` for CREATE2 salt mining
- Constructor: `AstraSendHook(poolManager, compliance, phoneResolver, feeCollector, supportedToken)`
- All compliance modules implement `ICompliance` and are hot-swappable via `setCompliance()`
- Tests use `vm.prank`, `vm.warp`, `vm.expectRevert` from forge-std
- `BalanceDelta` is from the swapper's perspective: positive = received, negative = sent

## Commit Conventions

```
type: description
```

Types: `feat`, `fix`, `test`, `chore`, `docs`, `script`, `refactor`

Examples:
- `feat(hook): add afterSwapReturnDelta to redirect USDT to escrow`
- `fix(compliance): use getComplianceStatus instead of isCompliant(addr, addr, 0)`
- `test(hook): add HookSwapPath integration tests`

## Code Style

```bash
forge fmt    # Format Solidity (configured in foundry.toml)
```

- Solidity 0.8.26, `via_ir`, 1M optimizer runs
- No Co-Authored-By lines in commits
- Prefer `getComplianceStatus()` over `isCompliant()` for non-swap gates (avoids amount=0 false negatives)

## Adding a Compliance Module

1. Implement `ICompliance`:
   - `isCompliant(address sender, address recipient, uint256 amount) returns (bool)`
   - `getComplianceStatus(address account) returns (bool isAllowed, uint256 dailyLimit, uint256 usedToday)`
   - `recordUsage(address account, uint256 amount)` — only callable by the hook
2. Deploy the module
3. Call `astraSendHook.setCompliance(newModuleAddress)` from the owner wallet
4. No hook redeployment needed

## Reporting Issues

Open an issue at [github.com/jayteemoney/AstrasendHook](https://github.com/jayteemoney/AstrasendHook/issues).
