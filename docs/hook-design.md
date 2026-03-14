# Hook Design — AstraSendHook

AstraSendHook registers **6 hook permissions** in Uniswap v4. Each one serves a specific, deliberate purpose in the remittance lifecycle. This document explains what each hook does, why it was chosen, and the engineering decisions behind it.

---

## Hook Permissions

```solidity
Hooks.Permissions({
    afterInitialize:        true,   // Pool corridor registration
    beforeAddLiquidity:     true,   // Compliance-gated LP
    beforeSwap:             true,   // Compliance check + transient cache
    afterSwap:              true,   // Record contribution
    beforeDonate:           true,   // Route donations to remittances
    afterSwapReturnDelta:   true,   // Auto-capture swap output into escrow
    // all others: false
})
```

---

## 1. `afterInitialize` — Pool Corridor Registration

**Trigger:** Called once when a new Uniswap v4 pool is initialized with this hook address.

**What it does:**
```solidity
function _afterInitialize(address, PoolKey calldata key, uint160, int24)
    internal override returns (bytes4)
{
    address token0 = Currency.unwrap(key.currency0);
    address token1 = Currency.unwrap(key.currency1);

    if (token0 != SUPPORTED_TOKEN && token1 != SUPPORTED_TOKEN) {
        revert TokenNotSupported();
    }

    bytes32 pid = PoolId.unwrap(key.toId());
    registeredPools[pid] = true;
    emit PoolRegistered(pid, token0, token1, key.fee);
}
```

**Why `afterInitialize`?**
Pool initialization is the natural place to validate and register a corridor. By requiring at least one token to be USDT, we ensure every pool using this hook is a valid stablecoin corridor. This also prevents the hook from being attached to arbitrary pools (ETH/BTC, etc.) where remittance semantics don't apply.

**Design decision:** Using `afterInitialize` instead of `beforeInitialize` ensures the pool is fully created before we record it. If the pool creation fails for any reason, we don't register a non-existent corridor.

---

## 2. `beforeAddLiquidity` — Compliance-Gated LP Provision

**Trigger:** Called before any liquidity is added to a registered pool.

**What it does:**
```solidity
function _beforeAddLiquidity(address sender, PoolKey calldata key, ...) {
    bytes32 pid = PoolId.unwrap(key.toId());

    if (registeredPools[pid]) {
        (bool allowed,,) = compliance.getComplianceStatus(sender);
        if (!allowed) revert ComplianceFailed();
    }
}
```

**Why gate LP provision?**

This is a critical regulatory consideration. In a remittance corridor:

1. **Unregistered pools are unaffected** — the hook only gates pools explicitly registered as remittance corridors. Standard Uniswap liquidity provision is untouched.

2. **LP = corridor operator** — Liquidity providers in a remittance corridor are effectively operating that corridor. Requiring compliance for LPs means the pool itself is composed of verified capital, which is important for jurisdictions that treat corridor operators as money service businesses.

3. **`getComplianceStatus` not `isCompliant`** — LP provision has no "transfer amount", so we can't use the standard `isCompliant(sender, recipient, amount)` check. Instead we use `getComplianceStatus(sender)` which checks allowlist/blocklist status without amount thresholds.

---

## 3. `beforeSwap` — Compliance Check + Transient Storage Cache

**Trigger:** Called before every swap on a registered pool.

**What it does:**
```solidity
function _beforeSwap(address sender, PoolKey calldata key,
    SwapParams calldata params, bytes calldata hookData)
{
    if (hookData.length == 0) return (selector, ZERO_DELTA, 0);

    RemitTypes.RemitHookData memory data = abi.decode(hookData, (...));
    if (!data.isContribution) return (selector, ZERO_DELTA, 0);

    // Validate remittance
    RemittanceStorage storage remit = remittances[data.remittanceId];
    if (remit.id == 0) revert RemittanceNotFound();
    if (remit.status != Status.Active) revert RemittanceNotActive();
    if (remit.expiresAt != 0 && block.timestamp >= remit.expiresAt) revert RemittanceExpired();

    // Compliance check
    if (!compliance.isCompliant(sender, remit.recipient, amount)) revert ComplianceFailed();
    if (sender == remit.recipient) revert RecipientCannotContribute();

    // EIP-1153 transient storage — pass remittanceId to afterSwap
    assembly { tstore(0x01, rid) }
}
```

**Key engineering decisions:**

### hookData pattern
Swaps without `hookData` pass through untouched — normal Uniswap swaps are unaffected. Only swaps that explicitly include a `RemitHookData` payload with `isContribution: true` are treated as remittance contributions. This is opt-in at the caller level, not automatic.

### EIP-1153 Transient Storage
Rather than re-decoding `hookData` in `afterSwap` (which would require re-reading calldata), we use `tstore` to write the `remittanceId` into transient storage slot `0x01`. In `afterSwap`, a `tload(0x01)` retrieves it cheaply within the same transaction.

This is a deliberate use of one of Ethereum's newest opcodes (EIP-1153, live since Cancun/Dencun). Transient storage is:
- **Cheaper than SSTORE/SLOAD** (warm slot cost)
- **Automatically cleared after the transaction** — no cleanup needed
- **Perfect for cross-hook communication** within a single transaction

### Compliance before swap execution
Checking compliance in `beforeSwap` means a non-compliant transaction **never executes**. The PoolManager reverts before any tokens move. This is far safer than checking after the fact and trying to reverse a swap.

---

## 4. `afterSwap` + `afterSwapReturnDelta` — Contribution Capture

**Trigger:** Called after every swap. The `afterSwapReturnDelta` permission allows the hook to return a delta that modifies the swapper's net token receipt.

**What it does:**
```solidity
function _afterSwap(address sender, PoolKey calldata key,
    SwapParams calldata params, BalanceDelta delta, bytes calldata hookData)
    returns (bytes4, int128)
{
    // ... decode hookData, check isContribution ...

    // BalanceDelta is from swapper's perspective:
    // positive = swapper receives that token (USDT output)
    int128 amount0 = delta.amount0();
    int128 amount1 = delta.amount1();

    uint256 contributionAmount;
    Currency usdtCurrency;
    if (Currency.unwrap(key.currency0) == remit.token) {
        contributionAmount = amount0 > 0 ? uint256(uint128(amount0)) : 0;
        usdtCurrency = key.currency0;
    } else ...

    // Pull USDT from PoolManager into escrow
    poolManager.take(usdtCurrency, address(this), contributionAmount);

    // Record contribution, trigger auto-release if target met
    _recordContribution(data.remittanceId, remit, sender, contributionAmount);

    // Return hookDeltaUnspecified = contributionAmount
    // This tells PoolManager: reduce swapper's USDT output by this amount
    return (selector, int128(uint128(contributionAmount)));
}
```

**Why `afterSwapReturnDelta`? — The Core Innovation**

This is the most technically sophisticated part of AstraSendHook and the reason Uniswap v4 was necessary.

In v3, there is no mechanism to intercept swap output mid-transaction. A swap always delivers tokens to the caller. To build escrow-on-swap, you would need:
1. A router contract that wraps the swap
2. An additional transfer from the caller to the escrow
3. Double gas cost, worse UX, more attack surface

In v4, `afterSwapReturnDelta` allows the hook to **claim the output tokens directly from the PoolManager's flash accounting system**. The flow is:

```
Swapper sends Token A → Pool
Pool computes USDT output → BalanceDelta (positive for swapper)
afterSwap:
    hook.take(USDT, hookAddress, amount)  // hook claims USDT from PM
    return int128(amount)                  // PM reduces swapper's USDT claim by `amount`
Result: USDT never reaches swapper — it goes directly into escrow
```

The swapper's net position: they spent Token A and received zero USDT (it went into escrow on their behalf). This is the correct semantic for a contribution — the swapper is voluntarily contributing their swap output to a remittance.

**BalanceDelta sign convention:**
BalanceDelta in `afterSwap` is from the **swapper's** perspective:
- Positive = swapper receives that token (this is the USDT output we want to capture)
- Negative = swapper sent that token (the input token)

This sign convention is non-obvious and is the source of a common hook bug (checking `< 0` instead of `> 0`). AstraSendHook correctly uses `amount0 > 0` to identify the output token.

---

## 5. `beforeDonate` — Donation Routing

**Trigger:** Called before a `donate()` call on a registered pool.

**What it does:**
```solidity
function _beforeDonate(address sender, PoolKey calldata key,
    uint256 amount0, uint256 amount1, bytes calldata)
{
    bytes32 pid = PoolId.unwrap(key.toId());
    uint256 remittanceId = donationRouting[pid];

    if (remittanceId == 0) return selector; // no routing configured

    RemittanceStorage storage remit = remittances[remittanceId];
    if (remit.status == Status.Active) {
        uint256 usdtAmount = /* whichever token is USDT */;
        if (usdtAmount > 0) {
            _recordContribution(remittanceId, remit, sender, usdtAmount);
        }
        emit DonationRouted(remittanceId, sender, amount0, amount1);
    }
}
```

**Why `beforeDonate`?**

Uniswap v4 introduces `donate()` — a way to send tokens directly to LP positions as in-range fees. AstraSendHook repurposes this mechanism: when a pool has a `donationRouting` configured by the admin, any donation to that pool is intercepted and credited to the target remittance.

This creates a novel **"donate-to-remit" primitive** — a community could set up a pool routing donations to a public fund (disaster relief, scholarship fund, community health), and anyone donating to the pool is contributing to that cause. The LPs receive nothing from these donations; they flow directly to the remittance recipient.

---

## Shared Internal Logic: `_recordContribution`

All three contribution paths (direct, swap, donate) converge at `_recordContribution`:

```solidity
function _recordContribution(uint256 remittanceId,
    RemittanceStorage storage remit,
    address contributor, uint256 amount) internal
{
    remit.currentAmount += amount;
    remit.contributions[contributor] += amount;

    // Track unique contributors (cap at MAX_CONTRIBUTORS = 50)
    if (remit.contributions[contributor] == amount) {
        if (remit.contributorList.length >= MAX_CONTRIBUTORS) revert MaxContributorsReached();
        remit.contributorList.push(contributor);
    }

    // Record usage in compliance module (daily limit tracking)
    compliance.recordUsage(contributor, amount);

    emit ContributionMade(remittanceId, contributor, amount, remit.currentAmount);

    // Auto-release if target met
    if (remit.currentAmount >= remit.targetAmount
        && autoReleaseEnabled && remit.autoRelease
        && remit.status == Status.Active)
    {
        _releaseRemittance(remittanceId);
    }
}
```

**Design decisions:**

- **MAX_CONTRIBUTORS = 50**: Prevents gas bomb attacks on `cancelRemittance`, which iterates over the contributor list to refund everyone. 50 was chosen as a generous cap (most remittances will have 1–10 contributors) while bounding worst-case gas.

- **Auto-release in the same transaction**: When `currentAmount >= targetAmount`, the release happens atomically in the same transaction as the final contribution. No second transaction needed. This is only possible because all state is in the same contract.

- **`compliance.recordUsage`**: Each contribution updates the compliance module's daily usage tracker for the contributor. This enforces per-address daily limits without a separate transaction.

---

## ReentrancyGuardTransient

AstraSendHook uses `ReentrancyGuardTransient` (OpenZeppelin v5) instead of the traditional `ReentrancyGuard`. This variant uses EIP-1153 transient storage for the reentrancy lock, which:

1. Is cheaper than SSTORE/SLOAD
2. Automatically clears after the transaction (no `ReentrancyGuardReentrantCall` state left over between transactions)
3. Is appropriate for all `nonReentrant` functions that may move tokens (`releaseRemittance`, `cancelRemittance`, `claimExpiredRefund`, `contributeDirectly`)

---

## Hook Address Mining

Uniswap v4 hooks must be deployed at addresses where specific bits encode the required permissions. AstraSendHook uses a CREATE2 salt-mining process to find a deployment address where bits 5, 7, 8, 10, 11, and 13 (from LSB) are set, corresponding to:

```
afterSwapReturnDelta | beforeDonate | afterSwap | beforeSwap |
beforeAddLiquidity | afterInitialize
```

The mining script in `script/` handles this automatically.
