# AstraSend — Scaled Vision

> What AstraSend becomes when deployed at production scale.

This document describes the full production architecture: how the current MVP grows into a protocol that handles millions of users across remittance corridors in Africa, Southeast Asia, and Latin America — with AI integrated not as a chat assistant, but as a core operational layer woven into the protocol itself.

---

## Where We Are Now (MVP)

| Component | State |
|-----------|-------|
| Hook | Deployed on Base Sepolia + Unichain Sepolia |
| Compliance | OpenCompliance (testnet permissionless) |
| Group funding | Live — multiple contributors, auto-release |
| Phone-to-wallet | Contract deployed, not active in UI (bootstrapping constraint) |
| AI | Chat assistant (help + FAQ) |
| Settlement | ~2s Base, ~200ms Unichain Flashblocks |
| Supported tokens | USDT (single token per pool) |
| Frontend | Next.js, wallet-only |

---

## Phase 1 — Controlled Launch

**Target:** First 10,000 users on Base mainnet. KYC-gated via AllowlistCompliance.

### What Changes

**Compliance:** Deploy `AllowlistCompliance`. A KYC partner (e.g., Persona, Smile Identity, Sumsub) calls `batchAddToAllowlist` after verifying users. Daily limits enforced per wallet.

**Phone numbers:** Enable phone mode in `send-form.tsx`. New user onboarding flow:
1. Recipient receives a remittance to their wallet address
2. Dashboard prompts: *"Register your phone to receive future sends by phone number"*
3. `registerPhoneString(phone, wallet)` — one transaction, self-service
4. Sender can now use phone mode immediately

**Multi-token corridors:** Deploy additional pools — USDT/USDC, USDT/ETH — for senders who hold different assets. The hook's `afterSwap` captures USDT regardless of what the sender swaps from.

**Admin dashboard (internal):** Web interface for the operations team to:
- View compliance status and daily usage per user
- Manage blocklist additions/removals
- Monitor remittance volumes and fee revenue per corridor
- Trigger compliance module upgrades

---

## Phase 2 — Open Scale with World ID

**Target:** Permissionless access, millions of users, sybil-proof.

### Compliance Upgrade

Deploy `WorldcoinCompliance`. Call `setCompliance(worldcoinAddress)` — one transaction.

From this point:
- No admin needed to onboard new users
- Any person with a World ID can self-verify in under 60 seconds via the Worldcoin IDKit widget
- Daily limits are enforced per human, not per wallet — genuine AML posture
- One iris = one account, globally

### The Worldcoin IDKit Integration

```typescript
// frontend: WorldID verification widget
import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";

<IDKitWidget
  app_id="app_astra_send"
  action="remit"
  verification_level={VerificationLevel.Orb}
  onSuccess={({ proof, merkle_root, nullifier_hash }) => {
    // Call WorldcoinCompliance.verifyAndRegister on-chain
    writeContract({
      address: contracts.compliance,
      abi: worldcoinComplianceAbi,
      functionName: "verifyAndRegister",
      args: [address, merkle_root, nullifier_hash, proof],
    });
  }}
/>
```

The ZK proof is generated client-side in the IDKit SDK and verified on-chain in `WorldcoinCompliance.verifyAndRegister`. No biometric data ever touches AstraSend's servers or the blockchain.

### New Corridors

With sybil resistance in place and permissionless onboarding, the protocol can safely open to:

| Corridor | Volume Potential | Notes |
|----------|-----------------|-------|
| Nigeria → UK (NGN/GBP) | $24B/year | Largest African remittance corridor |
| Ghana → USA (GHS/USD) | $4.5B/year | High Worldcoin orb coverage in Accra |
| Kenya → USA/UK (KES/USD) | $3.8B/year | M-Pesa integration possible |
| Philippines → USA (PHP/USD) | $36B/year | Largest remittance market globally |
| Mexico → USA (MXN/USD) | $63B/year | Second largest globally |

Each corridor gets its own Uniswap v4 pool. The hook registers it on `afterInitialize`. Liquidity providers earn fees from the constant swap activity.

---

## AI as a Core Protocol Layer

At MVP scale, AI is a chat assistant that answers questions. At production scale, AI becomes embedded in the protocol's operational intelligence. This is not about adding features — it is about the protocol becoming adaptive.

### 1. AI-Powered Corridor Routing

**Problem:** A sender in Lagos wants to send to a recipient in London. Multiple swap paths exist — USDT/ETH on Base, USDC/USDT on Unichain, direct bridge + swap. Each has different gas costs, slippage, and settlement times.

**What AI does:** An on-chain oracle + off-chain routing agent analyses real-time pool depths, gas prices, and cross-chain bridge latency to recommend the optimal path. The sender sees:

```
Recommended: Unichain (200ms settlement, $0.003 gas, 0.12% slippage)
Alternative:  Base    (2s settlement,    $0.006 gas, 0.08% slippage)
```

The agent monitors pool conditions continuously. During high-volatility periods it can automatically hold a contribution in escrow rather than completing a bad-price swap.

### 2. AI Fraud Detection (Compliance Layer)

**Problem:** Sybil attacks, structuring (breaking large amounts into many small sends to evade limits), and money mule patterns are hard to detect with on-chain rules alone.

**What AI does:** A fraud detection model runs off-chain, reading on-chain events in real time. It identifies:

- **Structuring patterns:** Address A sends 9,900 USDT five times in a day to five different wallets that all forward to the same destination — classic structuring
- **Mule networks:** Graph analysis of fund flows to detect hub-and-spoke patterns
- **Velocity anomalies:** Wallet suddenly active after months of dormancy with large sends
- **Cross-wallet coordination:** Detecting that 10 "different" wallets are operating from the same IP or device fingerprint

When the model flags an address, it calls `addToBlocklist` via an admin key with a structured reason code. The compliance system is still fully on-chain — AI just feeds it better signals faster than a human analyst could.

### 3. AI-Powered Phone Number Onboarding

**Problem (current):** Recipients must self-register their phone number on-chain. Most remittance recipients in Africa/SEA have never touched a crypto wallet.

**Solution at scale:** An AI agent operates an off-chain phone verification service:

1. Recipient receives an SMS: *"You have a pending remittance from [sender]. Claim it at astrasend.xyz. Reply YES to register this number."*
2. Recipient replies YES — agent verifies the phone number is theirs via OTP
3. Agent calls `registerPhoneString(phone, wallet)` where `wallet` is a smart account created in the background for the recipient
4. Sender's phone-mode remittance resolves and releases automatically
5. Recipient receives a follow-up SMS with their wallet details and a link to access funds

This turns the phone number bootstrapping problem into a pull-based onboarding flow. The recipient never needs to know what Ethereum is to claim their first remittance.

### 4. Predictive Liquidity Management

**Problem:** Remittance corridors have predictable patterns. Nigeria → UK volume spikes on Friday evenings when UK workers get paid. Philippines → USA spikes on the 1st and 15th (US paydays).

**What AI does:** A forecasting model predicts volume spikes 24–48 hours ahead using:
- Historical on-chain transaction patterns
- Macroeconomic signals (payday calendars, holiday schedules)
- Exchange rate volatility (high volatility → more urgent remittances)

It surfaces recommendations to liquidity providers:

```
"Friday 18:00–22:00 UTC: 340% expected volume increase on USDT/NGN pool.
Current liquidity covers $2.1M. Estimated $8.4M needed.
Projected LP fee yield: 2.1% for 4 hours."
```

LPs can automate responses with on-chain limit orders — deposit liquidity if yield exceeds X%, withdraw if price moves beyond Y%.

### 5. Compliance Intelligence for Recipients Without Wallets

At scale, millions of recipients receive funds but have no on-chain identity. AI manages the compliance bridge:

- Matches phone OTP verification to World ID registration when the recipient eventually onboards
- Detects if a phone number is registered to a flagged identity in off-chain sanctions databases (OFAC, UN, EU)
- Cross-references recipient address patterns with AML databases before releasing funds from escrow
- Generates SAR (Suspicious Activity Report) drafts automatically when flagging criteria are met, ready for human review

This is not replacing human compliance — it is making human compliance reviewers 100× more efficient by surfacing only the cases that need human judgment.

### 6. Group Remittance Coordination

**Current:** Multiple contributors can fund one remittance, but coordination is manual.

**At scale with AI:** A group coordinator agent:

- Organises a family group (e.g., five siblings contributing to their parents' medical bill in Nigeria)
- Tracks who has contributed, who is pending, and what the shortfall is
- Sends WhatsApp/SMS nudges to pending contributors: *"₦420,000 remaining for Mama's hospital bill. Your share: ₦84,000. Click to pay."*
- Handles currency conversion previews: *"Send $52 to cover your ₦84,000 share at today's rate"*
- Automatically triggers release when the target is met

The smart contract handles escrow and release. The AI agent handles the human coordination layer that makes group funding actually work in practice.

---

## Technical Scaling Architecture

### Smart Contract Layer (Unchanged by Design)

The hook contract does not need to change for any of the above. Its architecture already supports it:

- `setCompliance()` — swap in the AI-fed compliance module
- `setPhoneResolver()` — swap in the AI-managed resolver
- `createRemittanceByPhone()` — AI agent calls this when recipient onboards via SMS
- `beforeSwap` compliance gate — AI blocklist feeds into OpenCompliance/WorldcoinCompliance via standard admin calls

The hook is the stable, trustless settlement layer. AI operates at the edges.

### Off-Chain AI Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                        Event Indexer                         │
│  (watches RemittanceCreated, Contributed, Released events)   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
┌───────▼────────┐        ┌──────────▼──────────┐
│ Fraud Detection│        │  Routing Optimizer   │
│ Model          │        │  Agent               │
│ (flags wallets)│        │  (recommends paths)  │
└───────┬────────┘        └──────────┬───────────┘
        │                            │
        │  Admin key calls           │  Surfaces to frontend
        ▼                            ▼
┌───────────────────────────────────────────────┐
│              AstraSendHook (on-chain)          │
│    compliance.addToBlocklist(flaggedAddr)      │
│    getOptimalPool(amount, deadline)            │
└───────────────────────────────────────────────┘
```

### Phone Onboarding Agent

```
Sender creates remittance to phone number
    → PhoneNumberResolver.resolve() returns address(0)
    → Remittance is held in "pending phone resolution" state

AI Onboarding Agent
    → Detects unresolved phone remittance (event listener)
    → Sends OTP SMS to recipient phone
    → Recipient replies / visits link
    → Agent creates smart account for recipient
    → Agent calls registerPhoneString(phone, smartAccountAddr)
    → PhoneNumberResolver now resolves
    → Remittance auto-releases to smart account
    → Recipient receives SMS with access instructions
```

---

## Regulatory Positioning

At scale, AstraSend's compliance stack is built to support Money Services Business (MSB) licensing in key jurisdictions:

| Requirement | How AstraSend Addresses It |
|-------------|---------------------------|
| KYC | AllowlistCompliance (Phase 1) → WorldcoinCompliance (Phase 2) |
| AML daily limits | On-chain per-human limits via World ID nullifier |
| Transaction monitoring | AI fraud detection feeding on-chain blocklist |
| Sanctions screening | Off-chain OFAC/UN/EU database cross-reference |
| SAR filing | AI-assisted draft generation for human reviewer |
| Audit trail | All events on-chain, immutable, publicly verifiable |
| Data minimisation | No PII on-chain; phone stored as keccak256 hash; biometric never stored |

This positions AstraSend not as a grey-area crypto tool but as a compliant infrastructure layer that regulators can audit, MSB partners can integrate, and banks can eventually connect to.

---

## The Long-Term Network Effect

Each new corridor creates liquidity depth. Deeper liquidity → better swap rates → cheaper remittances → more users → more corridors. The hook's `beforeDonate` integration means even idle LP liquidity can be actively directed toward active remittances, keeping the yield attractive for liquidity providers even during low-volume periods.

With World ID as the identity layer, AstraSend achieves something no traditional remittance provider has: a **global, sybil-proof, privacy-preserving identity and compliance system** that doesn't require a bank account, a national ID, or an internet connection to receive funds — just a phone number and eventually a Worldcoin orb scan.

The goal is not to replace Western Union. The goal is to make it irrelevant for the billion people who send money home.
