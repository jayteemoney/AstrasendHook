# AstraSendHook - Project Guide

## What is this?
A Uniswap v4 hook for cross-border remittances. Built with Foundry, Solidity 0.8.26, targeting Base chain.

## Build & Test
```bash
forge build          # Compile
forge test           # Run all 182 tests
forge test -vvv      # Verbose output
make test-gas        # Gas report
```

## Project Structure
- `src/AstraSendHook.sol` - Main hook contract (beforeSwap/afterSwap + escrow)
- `src/compliance/` - Pluggable compliance modules (AllowlistCompliance, WorldcoinCompliance)
- `src/compliance/PhoneNumberResolver.sol` - Phone-to-address mapping
- `src/interfaces/` - All interfaces (ICompliance, IWorldID, IAstraSendHook, IPhoneNumberResolver)
- `src/libraries/RemitTypes.sol` - Shared types, enums, events
- `test/utils/HookTest.sol` - Base test contract with setup helpers
- `script/Deploy.s.sol` - Deployment (supports COMPLIANCE_TYPE=allowlist|worldcoin)

## Key Patterns
- Hook address must encode permissions in lowest bits (uses HookMiner.find for salt)
- Constructor: `AstraSendHook(poolManager, compliance, phoneResolver, feeCollector, supportedToken)`
- All compliance modules implement `ICompliance` and are hot-swappable via `setCompliance()`
- Tests use `vm.prank`, `vm.warp`, `vm.expectRevert` from forge-std

## Conventions
- Commit style: `type: description` (feat, test, fix, chore, docs, script)
- Solidity formatting: `forge fmt` (configured in foundry.toml)
- No Co-Authored-By lines in commits
