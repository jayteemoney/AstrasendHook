# Compliance System — AstraSend

---

## Architecture Overview

AstraSend implements a **pluggable, modular compliance architecture**. The hook never knows which compliance module is active — it only speaks to the `ICompliance` interface. This means:

- Compliance can be **hot-swapped without redeploying the hook** (`setCompliance(newAddress)`)
- The same hook serves testnet → Phase 1 launch → full production with a single transaction upgrade
- Third-party compliance providers can integrate by implementing `ICompliance`

All three modules share the same interface, the same daily limit mechanics, and the same admin role system. They differ only in **who is allowed to transact**.

---

## The ICompliance Interface

```solidity
interface ICompliance {
    /// Full compliance check — used before every swap contribution and direct contribution
    function isCompliant(address sender, address recipient, uint256 amount)
        external view returns (bool);

    /// Status snapshot for the UI — balance, limit, used today
    function getComplianceStatus(address account)
        external view returns (bool isAllowed, uint256 dailyUsed, uint256 dailyLimit);

    /// Remaining send capacity today
    function getRemainingDailyLimit(address account) external view returns (uint256);

    /// Is this address explicitly blocked?
    function isBlocked(address account) external view returns (bool);

    /// Called by the hook after a successful contribution to record usage
    function recordUsage(address account, uint256 amount) external;
}
```

**Critical design note:** `isCompliant(addr, addr, 0)` always returns `false` because `amount=0 < minimumAmount`. For compliance gates that have no send amount (e.g., `beforeAddLiquidity`), the hook calls `getComplianceStatus(account)` instead, which checks allowlist/blocklist without applying an amount threshold.

---

## Where the Hook Calls Compliance

| Hook Point / Function | Call | Purpose |
|---|---|---|
| `createRemittance` | `isCompliant(creator, recipient, targetAmount)` | Validate both parties before escrow is created |
| `createRemittanceByPhone` | `isCompliant(creator, resolvedRecipient, targetAmount)` | Same check after phone → wallet resolution |
| `beforeSwap` | `isCompliant(swapper, remit.recipient, swapAmount)` | Gate swap-based contributions |
| `contributeDirectly` | `isCompliant(msg.sender, remit.recipient, amount)` | Gate direct USDT contributions |
| `beforeAddLiquidity` | `getComplianceStatus(sender).isAllowed` | Gate LP provision (no amount to check) |
| `_recordContribution` (internal) | `recordUsage(contributor, amount)` | Deduct from daily limit after contribution confirms |

`releaseRemittance` does **not** call compliance — releasing already-escrowed funds is not a new transfer.

---

## Daily Limit System (Shared by All Three Modules)

All compliance modules track usage identically:

```solidity
// Key: address => UTC day number => amount used
mapping(address => mapping(uint256 => uint256)) public dailyUsage;

// UTC day number — auto-resets at midnight with no cron job
uint256 today = block.timestamp / 1 days;

// On every contribution:
dailyUsage[sender][today] += amount;

// Remaining capacity:
remainingLimit = dailyLimit - dailyUsage[sender][today]
```

**Default:** 10,000 USDT/day per address (`10_000 * 1e6` in 6-decimal USDT)

**Per-account overrides:** Owner can set custom limits via `updateDailyLimit(account, newLimit)` — useful for business users or high-volume corridors.

Historical data is preserved — auditing past days is possible by querying `dailyUsage[account][dayNumber]`.

---

## Admin Role System (All Three Modules)

Each module has a two-tier access control:

| Role | Who | What They Can Do |
|------|-----|-----------------|
| `owner` | Protocol deployer | Set hook address, set default limits, set minimum amount, grant/revoke admin roles |
| `admin` | Operational addresses | Manage blocklist (OpenCompliance), allowlist (AllowlistCompliance), or blocklist + revocations (WorldcoinCompliance) |

```solidity
// Grant admin
addAdmin(address)    // onlyOwner

// Revoke admin
removeAdmin(address) // onlyOwner

// Admin check
modifier onlyAdmin {
    if (msg.sender != owner() && !admins[msg.sender]) revert NotAuthorized();
}
```

`recordUsage` is further restricted to `onlyHook` — only the AstraSendHook contract can deduct daily limits, preventing manipulation.

---

## Module 1: OpenCompliance

**File:** `src/compliance/OpenCompliance.sol`
**Deployed:** Base Sepolia + Unichain Sepolia (active on both testnets)
**Use case:** Testnet, demos, open pilots — permissionless by default

### How It Works

Every wallet is allowed unless explicitly blocked. The only gates are:

1. **Blocklist** — admin can block known bad actors or test addresses
2. **Daily limit** — prevents runaway usage; defaults to 10,000 USDT/day
3. **Minimum amount** — 1 USDT minimum per transaction

```solidity
function isCompliant(address sender, address recipient, uint256 amount)
    external view returns (bool)
{
    if (blocklist[sender] || blocklist[recipient]) return false;
    if (amount > 0 && amount < minimumAmount) return false;
    if (amount > 0) {
        uint256 today = block.timestamp / 1 days;
        uint256 limit = customDailyLimits[sender] > 0
            ? customDailyLimits[sender] : defaultDailyLimit;
        if (dailyUsage[sender][today] + amount > limit) return false;
    }
    return true;
}
```

`getComplianceStatus` returns `isAllowed = !blocklist[account]` — an address is allowed unless it has been explicitly added to the blocklist.

### Blocklist Behaviour in the UI

On the testnet frontend, if a wallet is on the blocklist:
- The Send form shows an amber warning: *"Compliance check failed for this transfer"*
- The submit button is disabled
- The Dashboard shows `isAllowed: false` on the compliance status card

If you are testing and see this warning on a recipient address, the wallet has been added to the blocklist. An admin must call `removeFromBlocklist(address)` to restore access.

### Deployed Addresses

| Chain | Address |
|-------|---------|
| Base Sepolia (84532) | `0xAC4038cD8EF3Bf8a37b4D910A6007A56167226AE` |
| Unichain Sepolia (1301) | `0x61583daD9B340FF50eb6CcA6232Da15B0850946F` |

---

## Module 2: AllowlistCompliance

**File:** `src/compliance/AllowlistCompliance.sol`
**Status:** Deployed on testnet; designated for Phase 1 mainnet launch
**Use case:** Regulated deployment where all participants must complete off-chain KYC first

### How It Works

Addresses are **denied by default**. Only addresses explicitly added to the allowlist may transact. This is a whitelist-first model suited to jurisdictions where an operator must verify user identity before allowing financial transactions.

```solidity
function isCompliant(address sender, address recipient, uint256 amount)
    external view returns (bool)
{
    if (blocklist[sender] || blocklist[recipient]) return false;
    if (!allowlist[sender]) return false;    // denied by default
    if (amount < minimumAmount) return false;

    uint256 today = block.timestamp / 1 days;
    uint256 limit = customDailyLimits[sender] > 0
        ? customDailyLimits[sender] : defaultDailyLimit;
    if (dailyUsage[sender][today] + amount > limit) return false;

    return true;
}
```

Note: The recipient does **not** need to be on the allowlist — only the sender. This allows recipients who haven't onboarded to still receive funds from verified senders.

### Onboarding Flow

```
User completes KYC (off-chain, via partner)
    ↓
KYC partner calls addToAllowlist(userAddress, customLimit)
    ↓
User can now send on AstraSend
    ↓
recordUsage deducts from their daily limit on each contribution
```

For bulk onboarding events:

```solidity
// Add many users at once
batchAddToAllowlist(
    [addr1, addr2, addr3, ...],
    [0, 0, 5000_000000, ...]  // 0 = use default limit, custom for high-volume users
)
```

### Why This Doesn't Scale

AllowlistCompliance requires **one admin action per user**. For a consumer remittance corridor with millions of users, this becomes:
- Operationally expensive (someone must run the allowlist)
- A centralization point (if the admin is compromised, fake accounts get in)
- A bottleneck (users can't self-onboard)
- Privacy-leaking (the admin knows every wallet that transacted)

This is acceptable for a controlled launch with a known user base, but it is explicitly a transitional phase. WorldcoinCompliance replaces it at scale.

---

## Module 3: WorldcoinCompliance

**File:** `src/compliance/WorldcoinCompliance.sol`
**Status:** Fully implemented and tested; awaiting mainnet deployment (requires World ID Router on target chain)
**Use case:** Full production — open to anyone who has completed Worldcoin biometric verification

### The Problem with Address-Based Limits

Any per-address daily limit is trivially broken: one person creates 100 wallets and hits 100 × 10,000 USDT = 1,000,000 USDT per day in effective throughput. OpenCompliance and AllowlistCompliance both have this weakness because they track limits per `address`, not per *person*.

WorldcoinCompliance solves this by linking each wallet to a unique verified human using **zero-knowledge proof of personhood**.

### How World ID Works

Worldcoin's physical Orb device scans a user's iris and generates an **IrisCode** — a biometric hash. This never leaves the device in raw form. Instead:

1. The IrisCode is transformed into a **nullifier hash** — deterministic, specific to the AstraSend app ID and action ID
2. A **ZK-SNARK proof** is generated that proves: *"I have a valid World ID and have not verified this action before"* — without revealing the IrisCode or identity
3. The proof is submitted once to `verifyAndRegister(signal, root, nullifierHash, proof)`
4. The contract calls the World ID Router, which verifies the proof on-chain
5. `verified[walletAddress] = true` and `nullifierHashes[nullifierHash] = true` are stored

If the same person tries to verify a second wallet: same iris → same nullifier → `nullifierHashes[nullifierHash]` is already `true` → reverts with `NullifierAlreadyUsed`.

### The Verification Flow

```solidity
function verifyAndRegister(
    address signal,           // the wallet being verified (msg.sender in frontend)
    uint256 root,             // World ID Merkle tree root
    uint256 nullifierHash,    // unique per-person per-app
    uint256[8] calldata proof // ZK-SNARK
) external {
    if (nullifierHashes[nullifierHash]) revert NullifierAlreadyUsed();

    // AstraSend-specific external nullifier: keccak256("astra-send" + "remit")
    uint256 externalNullifierHash = uint256(
        keccak256(abi.encodePacked(appId, ACTION_ID))
    );

    uint256 signalHash = uint256(keccak256(abi.encodePacked(signal)));

    // Reverts if proof is invalid
    worldId.verifyProof(root, ORB_GROUP_ID, signalHash,
        nullifierHash, externalNullifierHash, proof);

    nullifierHashes[nullifierHash] = true;
    verified[signal] = true;

    emit WorldIDVerified(signal, nullifierHash);
}
```

### What `isCompliant` Checks

```solidity
function isCompliant(address sender, address recipient, uint256 amount)
    external view returns (bool)
{
    if (blocklist[sender] || blocklist[recipient]) return false;
    if (!verified[sender]) return false;     // replaces allowlist
    if (amount < minimumAmount) return false;

    uint256 today = block.timestamp / 1 days;
    uint256 limit = customDailyLimits[sender] > 0
        ? customDailyLimits[sender] : defaultDailyLimit;
    if (dailyUsage[sender][today] + amount > limit) return false;

    return true;
}
```

The critical difference from OpenCompliance: `!verified[sender]` replaces `blocklist[sender]`. Access is now *deny-by-default for unverified wallets*, but **self-service** — no admin needed to onboard. Any user who scans with the Worldcoin orb can verify themselves.

### Why the Daily Limit Now Actually Means Something

| Scenario | OpenCompliance | WorldcoinCompliance |
|----------|---------------|---------------------|
| User creates 100 wallets | 100 × 10,000 = 1M USDT/day | 1 × 10,000 USDT/day (one nullifier) |
| User registers 10 phones for 10 wallets | 10 × 10,000 = 100K USDT/day | 1 × 10,000 USDT/day |
| Sybil attacker | Creates unlimited accounts | Bounded by biology — one iris |

The daily limit becomes a genuine per-human AML control, not a cosmetic restriction.

### Revocation

If a verified wallet is flagged for fraud or sanctions:

```solidity
revokeVerification(address account)   // onlyAdmin
addToBlocklist(address account)        // onlyAdmin — immediate block
```

Importantly, revoking a wallet **does not** release the nullifier — the person cannot reverify a new wallet either, preventing them from simply switching wallets after being caught.

### Deployment Requirements

WorldcoinCompliance requires the **World ID Router** contract to be live on the target chain. As of the UHI8 submission:
- World ID Router is available on Ethereum mainnet and Polygon
- Base and Unichain mainnet integration is in progress via Worldcoin's cross-chain message relay
- The contract is fully implemented, tested (41 tests), and awaiting chain availability

Constructor parameters:
```solidity
new WorldcoinCompliance(
    IWorldID(worldIdRouterAddress),  // World ID Router on target chain
    "app_astra_send"                 // your Worldcoin developer app ID
)
```

---

## Compliance Module Comparison

| Feature | OpenCompliance | AllowlistCompliance | WorldcoinCompliance |
|---------|---------------|---------------------|---------------------|
| Default access | Open (all) | Denied (none) | Denied (unverified) |
| Onboarding | None needed | Admin adds per user | Self-service iris scan |
| Sybil resistance | None | Partial (admin-controlled) | Full (one iris = one wallet) |
| Daily limit scope | Per wallet address | Per wallet address | Per verified human |
| Admin overhead | Low (blocklist only) | High (allowlist every user) | Low (blocklist only) |
| Privacy | Minimal | Admin knows all users | Zero-knowledge |
| Scales to 1M users | Yes | No | Yes |
| Current status | Live on testnets | Ready for launch | Awaiting chain support |

---

## Phone Number Feature — Status and Roadmap

The `PhoneNumberResolver` contract maps `keccak256(phoneNumber) → walletAddress`, enabling senders to send to a phone number instead of a wallet address.

**Contract status:** Fully implemented, tested (34 tests), and deployed on both testnets.

**UI status:** The phone number input is **not currently active in the send form** due to a bootstrapping problem: the contract requires recipients to self-register their phone number by calling `registerPhoneString(phone, wallet)` from their own wallet. This is the correct design for privacy — no admin can register a phone for a wallet they don't control — but it creates a chicken-and-egg problem at launch: senders cannot send to phone numbers until recipients have already onboarded and registered.

The code is deliberately preserved in the repository because:

1. **The contract is correct and production-ready.** The design is privacy-preserving by construction — phone numbers are stored as keccak256 hashes and cannot be read back. This is the right approach.
2. **The UX problem is a growth problem, not a technical problem.** Once recipients are onboarding via the app (e.g., to claim incoming remittances), phone self-registration becomes a natural step in their flow.
3. **Recipients receiving their first remittance to a wallet address can register their phone for all future sends.** The `receive/page.tsx` already surfaces the registration UI.
4. **For judges:** This is a deliberate MVP decision. The technical foundation — `createRemittanceByPhone`, `PhoneNumberResolver`, resolver hooks — is complete and production-ready. Enabling it in the send form requires only recipient adoption, not additional contract work.

**Planned activation path:**
1. Recipient claims a remittance → prompted to register phone number
2. Sufficient phone registrations exist on the network
3. Re-enable phone mode in `send-form.tsx` — one feature flag change

---

## Switching Compliance Modules

```bash
# Deploy new module (example: AllowlistCompliance)
forge script script/DeployAllowlist.s.sol \
  --rpc-url $BASE_RPC \
  --broadcast --verify

# Set hook address on new module
cast send $NEW_COMPLIANCE "setHook(address)" $HOOK_ADDRESS \
  --rpc-url $BASE_RPC --private-key $OWNER_KEY

# Swap in new module — one transaction, takes effect immediately
cast send $HOOK_ADDRESS "setCompliance(address)" $NEW_COMPLIANCE \
  --rpc-url $BASE_RPC --private-key $OWNER_KEY
```

All future transactions use the new module immediately. Pending remittances continue to accept contributions under the new rules. No liquidity migration needed. No hook redeployment.
