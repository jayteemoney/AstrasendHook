# Deployment Guide — AstraSend

---

## Live Deployments

### Base Sepolia (Chain ID: 84532)

| Contract | Address | Explorer |
|---|---|---|
| AstraSendHook | `0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4` | [View](https://sepolia.basescan.org/address/0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4) |
| OpenCompliance | `0xa15d7d5505BC3D7B74A27808141D86752EfE09b6` | [View](https://sepolia.basescan.org/address/0xa15d7d5505BC3D7B74A27808141D86752EfE09b6) |
| PhoneNumberResolver | `0x29f47d33B73712000f554FAB4119eE6ce0741Dea` | [View](https://sepolia.basescan.org/address/0x29f47d33B73712000f554FAB4119eE6ce0741Dea) |
| USDT (MockUSDT) | `0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA` | [View](https://sepolia.basescan.org/address/0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA) |

### Unichain Sepolia (Chain ID: 1301)

| Contract | Address | Explorer |
|---|---|---|
| AstraSendHook | `0x31c76772ad6A821F0908AC3c6Caa706a043A98E4` | [View](https://sepolia.uniscan.xyz/address/0x31c76772ad6A821F0908AC3c6Caa706a043A98E4) |
| OpenCompliance | `0xBfBD571aCA171167833355e944c5CC8E96FE8A16` | [View](https://sepolia.uniscan.xyz/address/0xBfBD571aCA171167833355e944c5CC8E96FE8A16) |
| PhoneNumberResolver | `0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA` | [View](https://sepolia.uniscan.xyz/address/0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA) |
| USDT (MockUSDT) | `0x3E4e5a1Fb92f70dB37019F3E813C79341ede37E6` | [View](https://sepolia.uniscan.xyz/address/0x3E4e5a1Fb92f70dB37019F3E813C79341ede37E6) |

---

## Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Clone the repository
git clone https://github.com/jayteemoney/AstrasendHook
cd AstrasendHook

# Install dependencies
forge install

# Build
forge build

# Run tests
forge test
```

---

## Environment Variables

Create a `.env` file (never commit this):

```bash
# Deployer private key
PRIVATE_KEY=0x...

# RPC endpoints
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_MAINNET_RPC=https://mainnet.base.org
UNICHAIN_SEPOLIA_RPC=https://sepolia.unichain.org
UNICHAIN_MAINNET_RPC=https://mainnet.unichain.org

# Block explorer API keys
BASESCAN_API_KEY=...
ETHERSCAN_API_KEY=...

# Config
FEE_COLLECTOR=0x...   # Address to receive platform fees
USDT_ADDRESS=0x...    # USDT contract on target chain
```

---

## Deployment Order

Hook deployment requires careful ordering because the hook address must be mined to match the required permission bits.

### Step 1: Deploy Compliance Module

```bash
# Deploy OpenCompliance (testnet)
forge script script/DeployOpenCompliance.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify

# Deploy AllowlistCompliance (mainnet Phase 1)
forge script script/DeployAllowlistCompliance.s.sol \
  --rpc-url $BASE_MAINNET_RPC \
  --broadcast \
  --verify
```

### Step 2: Deploy PhoneNumberResolver

```bash
forge script script/DeployPhoneResolver.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify
```

### Step 3: Mine Hook Address + Deploy Hook

The hook must be deployed at an address encoding its permissions. The deployment script handles CREATE2 salt mining automatically:

```bash
forge script script/DeployAstraSendHook.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify
```

The script will:
1. Mine a CREATE2 salt that produces an address with the correct permission bits
2. Deploy the hook via the Uniswap v4 `HookMiner` utility
3. Verify the deployed address matches expected permissions

### Step 4: Configure Compliance Module

After deploying the hook, point the compliance module to it:

```bash
# Set the hook address in compliance (so recordUsage is authorized)
cast send $COMPLIANCE_ADDRESS "setHook(address)" $HOOK_ADDRESS \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY
```

### Step 5: Initialize a Pool

```bash
# Initialize a USDT/ETH pool with the hook
forge script script/InitializePool.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast
```

This calls `PoolManager.initialize(key, sqrtPriceX96, "")` where `key.hooks = address(astraSendHook)`. The `afterInitialize` hook validates USDT is present and registers the pool as a corridor.

---

## Post-Deployment Configuration

### Add test users to OpenCompliance (testnet)

No action needed — OpenCompliance is permissionless. All addresses can transact by default unless explicitly blocked.

### Add users to AllowlistCompliance (mainnet)

```bash
# Single address
cast send $COMPLIANCE "addToAllowlist(address)" $USER_ADDRESS \
  --private-key $PRIVATE_KEY

# Batch (for onboarding)
cast send $COMPLIANCE "batchAllow(address[])" "[0x..., 0x...]" \
  --private-key $PRIVATE_KEY
```

### Register test phone numbers

```bash
# User self-registers (must be called from the wallet being registered)
cast send $PHONE_RESOLVER "registerPhoneString(string,address)" \
  "+2348012345678" $WALLET_ADDRESS \
  --private-key $WALLET_PRIVATE_KEY
```

---

## Upgrade Path: Testnet → Mainnet

1. Deploy `AllowlistCompliance` on mainnet
2. Deploy `PhoneNumberResolver` on mainnet
3. Mine + deploy `AstraSendHook` on mainnet (new address)
4. Configure compliance → hook, hook → compliance
5. KYC partner begins calling `addToAllowlist` for verified users
6. Initialize USDT/ETH and USDT/USDC pools on mainnet
7. Update `frontend/src/config/contracts.ts` with mainnet addresses

### Phase 2 (World ID)

1. Deploy `WorldcoinCompliance` on a chain with World ID Router support
2. `astraSendHook.setCompliance(worldcoinComplianceAddress)`
3. Users verify with Worldcoin IDKit in the frontend
4. Daily limits become sybil-resistant from that point forward

---

## Frontend Configuration

Update contract addresses in `frontend/src/config/contracts.ts` (current testnet addresses are already populated):

```typescript
export const CONTRACT_ADDRESSES = {
  84532: {  // Base Sepolia
    astraSendHook: "0x3E2c98Aa25Ac5a96126e07458ff4F27b5A9aD8e4" as Address,
    compliance:    "0xa15d7d5505BC3D7B74A27808141D86752EfE09b6" as Address,
    phoneResolver: "0x29f47d33B73712000f554FAB4119eE6ce0741Dea" as Address,
    usdt:          "0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA" as Address,
  },
  1301: {  // Unichain Sepolia
    astraSendHook: "0x31c76772ad6A821F0908AC3c6Caa706a043A98E4" as Address,
    compliance:    "0xBfBD571aCA171167833355e944c5CC8E96FE8A16" as Address,
    phoneResolver: "0x1754e1dBc66a0997D0442D7a24DB149d494F6FcA" as Address,
    usdt:          "0x3E4e5a1Fb92f70dB37019F3E813C79341ede37E6" as Address,
  },
};
```

When mainnet contracts are deployed, add their chain IDs (8453 for Base, 130 for Unichain) to this map and update `wagmi.ts` to include the mainnet chains.

---

## Running Tests

```bash
# All tests
forge test

# With verbose output
forge test -vvv

# Specific test file
forge test --match-path test/HookSwapPath.t.sol -vvv

# With gas reporting
forge test --gas-report

# Coverage
forge coverage
```

**Test breakdown (229 total):**
- `AstraSendHook.t.sol` — remittance lifecycle (create, contribute, release, cancel, expire, refund)
- `HookSwapPath.t.sol` — all 4 hook paths with full PoolManager integration
- `Compliance.t.sol` — all three compliance modules
- `PhoneResolver.t.sol` — phone registration, resolution, admin operations
- Invariant tests — solvency (total contributions == sum of contributor balances)
- Fuzz tests — contribution amounts, expiry timestamps, contributor counts up to MAX_CONTRIBUTORS
