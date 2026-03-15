# AstraSend User Guide

Low-cost, compliant, group-funded cross-border remittances powered by Uniswap v4 hooks.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Sending Money](#3-sending-money)
4. [Receiving Money](#4-receiving-money)
5. [Registering Your Phone Number](#5-registering-your-phone-number)
6. [Contributing to a Remittance](#6-contributing-to-a-remittance)
7. [Releasing Funds](#7-releasing-funds)
8. [Cancelling a Remittance](#8-cancelling-a-remittance)
9. [Claiming an Expired Refund](#9-claiming-an-expired-refund)
10. [Transaction History](#10-transaction-history)
11. [AI Assistant](#11-ai-assistant)
12. [Supported Chains](#12-supported-chains)
13. [Compliance & Verification](#13-compliance--verification)
14. [Fees & Limits](#14-fees--limits)
15. [Remittance Statuses](#15-remittance-statuses)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Getting Started

### What You Need

- A Web3 wallet (MetaMask, Coinbase Wallet, WalletConnect-compatible, etc.)
- USDT tokens on a supported chain (Base or Unichain)
- A small amount of ETH for gas fees (typically under $0.01 on Base/Unichain)

### Connecting Your Wallet

1. Open the AstraSend app in your browser.
2. You will land on the **home page** showing an overview of the protocol, features, comparison with traditional remittances, technology stack, and FAQ.
3. Click **Connect Wallet** (in the top-right header).
4. Choose your wallet provider and approve the connection.
5. Once connected, the **navigation menu** appears in the header: **Dashboard**, **Send**, **Receive**, **History**.
6. You are automatically taken to the Dashboard.

---

## 2. Dashboard Overview

The Dashboard is your home base. It shows three stat cards at the top:

| Card | What It Shows |
|------|--------------|
| **USDT Balance** | Your current USDT balance on the connected chain |
| **Active Remittances** | Number of remittances currently in progress |
| **Daily Limit** | Your remaining USDT send limit for today |

Below the stats you will find:

- **Quick Actions** — two buttons: **Send Money** and **Receive**.
- **Register phone** nudge (amber) — appears if you have not yet registered a phone number. Click to go to the Receive page and register.
- **Active Remittances** — a list of all your in-progress remittances (ones you created or are a recipient of). Click any card to view its full details.
- **Recent Activity** — the last 3 completed remittances with a **View All** link to the full history.

The Dashboard updates in **real time** — when someone contributes to your remittance or a status changes on-chain, the data refreshes automatically via event listeners.

---

## 3. Sending Money

### Step-by-Step

1. From the Dashboard, click **Send Money** (or navigate to `/send`).
2. The Send page shows the **SendForm** on the left and helpful info cards on the right.

#### Fill in the Form

3. **Compliance Status** is displayed at the top of the form. Your remaining daily limit is shown.

4. **Recipient** — enter the recipient's wallet address (`0x...`) **or** their phone number (`+countrycode...`).
   - Address mode: enter a `0x...` Ethereum address.
   - Phone mode: enter a phone number in E.164 format (e.g., `+2348012345678`). The form resolves it to the registered wallet and shows a preview.

5. **Amount (USDT)** — enter the amount to send. The fee breakdown updates live:
   - Platform Fee (read from the contract, currently 0.5%)
   - Net amount the recipient will receive

6. **Expiry (days, optional)** — set a deadline. If the target is not met by this date, contributors can claim full refunds. Leave empty for no expiry.

7. **Purpose (optional)** — describe what the remittance is for (e.g., "School fees", "Medical expenses"). This is hashed on-chain for privacy.

8. **Auto-release** — enabled by default. When toggled on, funds are automatically released to the recipient as soon as the target amount is reached. When off, the recipient must manually release.

#### Pre-Send Compliance Check

9. AstraSend runs a **live compliance check** against the contract before you submit. If the check fails (e.g., recipient is blocked, daily limit exceeded), an amber warning appears and the submit button is disabled. This saves you gas by preventing a transaction that would revert.

#### Submit

10. Click **Create Remittance**.
11. Your wallet will prompt you to **confirm the transaction**.
12. Wait for on-chain confirmation (button shows "Creating Remittance...").
13. On success, a green banner appears: *"Remittance created successfully!"*
14. The form resets. Navigate to the Dashboard to see your new remittance.

---

## 4. Receiving Money

1. Navigate to **Receive** (from the header or Dashboard).
2. At the top of the page you can **register your phone number** (see section 5 below).
3. Your **wallet address** is displayed with a one-click **Copy** button. Share this address or your registered phone number with anyone who wants to send you money.
4. Below the address, all remittances where **you are the recipient** are listed, split into:
   - **Pending** — active remittances waiting for funding or your release.
   - **Completed** — released or cancelled remittances.
5. Click any remittance card to open its **detail page** where you can release funds once the target is met.

---

## 5. Registering Your Phone Number

Registering lets senders send money to your phone number instead of your wallet address. The phone number is stored as a privacy-preserving hash — it cannot be read back from the contract.

### How to Register

1. Navigate to **Receive**.
2. In the **Phone Registration** section at the top, enter your phone number in E.164 format:
   - Format: `+[country code][number]` (no spaces, dashes, or brackets)
   - Example: `+2348012345678` (Nigeria), `+14155552671` (USA)
3. Click **Register Phone Number**.
4. Confirm the transaction in your wallet.
5. Once confirmed, senders can now send to your phone number directly.

### Notes

- You must call this from the wallet you want to link. The contract enforces this — you cannot register a phone for someone else's wallet.
- To update your registered wallet: use the **Update Wallet** option (calls `updateMyWallet(newAddress)`).
- To unregister: use the **Unregister** option (calls `unregisterMyPhone()`).

---

## 6. Contributing to a Remittance

AstraSend supports **group contributions** — multiple people can pool funds toward a single remittance (e.g., family members contributing to tuition).

### Step-by-Step

1. Open a remittance detail page (`/remittance/[id]`). You can reach this by:
   - Clicking a remittance card from the Dashboard, Receive, or History pages.
   - Receiving a direct link from the remittance creator.

2. If the remittance is **Active**, you are **not the recipient**, and it has **not expired**, the **Contribute** section appears in the sidebar.

3. In the Contribute form:
   - Enter an amount in USDT.
   - Or click **"Fill remaining: $X.XX"** to auto-fill the exact amount needed to reach the target.
   - Your current USDT balance is displayed.

4. **USDT Approval** (one-time per amount):
   - If this is your first contribution (or the amount exceeds your prior approval), the button will say **"Approve & Contribute"**.
   - Click it to first approve the AstraSendHook contract to spend your USDT.
   - After approval confirms, the button changes to **"Contribute"**.
   - Click again to submit the contribution.
   - Subsequent contributions within the approved amount skip the approval step.

5. Once confirmed, you will see *"Contribution successful!"* and the progress bar updates in real time.

---

## 7. Releasing Funds

When a remittance reaches its **target amount**, the funds can be released to the recipient.

### Auto-Release (Default)

If auto-release is enabled (the default), funds are **automatically released** to the recipient as soon as the target is met. No action required.

### Manual Release

If auto-release is disabled, the **recipient** must manually release:

1. Open the remittance detail page.
2. A green **"Ready to Release"** section appears in the sidebar with the message: *"The target amount has been reached. Release funds to your wallet."*
3. Click **"Release Funds"**.
4. Confirm in your wallet.
5. Funds are sent to your wallet minus the platform fee.
6. The fee breakdown is shown on the detail page:
   - Fee amount (e.g., 0.5% of total)
   - Net amount you receive

---

## 8. Cancelling a Remittance

Only the **creator** of a remittance can cancel it, and only while it is still **Active**.

1. Open the remittance detail page.
2. The **"Cancel Remittance"** section appears in the sidebar.
3. Click **"Cancel & Refund"**.
4. Confirm in your wallet.
5. **All contributors are refunded** their full contributions automatically.
6. The remittance status changes to **Cancelled**.

---

## 9. Claiming an Expired Refund

If a remittance has an **expiry date** and the target was not met in time:

1. Open the remittance detail page.
2. An amber **"Expired - Claim Refund"** section appears in the sidebar.
3. Your contribution amount is shown (e.g., *"Claim $250.00 Refund"*).
4. Click the claim button.
5. Confirm in your wallet.
6. Your contribution is refunded in full.

**Note:** Each contributor claims their own refund individually. The creator can also cancel at any time before expiry to trigger an automatic refund to all contributors.

---

## 10. Transaction History

1. Navigate to **History** from the header.
2. View all your remittances (sent and received) in one list, sorted by most recent.
3. **Filter** by status using the tabs at the top:
   - **All** — every remittance
   - **Active** — currently in progress
   - **Released** — successfully completed
   - **Cancelled** — cancelled by creator
   - **Expired** — past their deadline
4. Click any card to view the full remittance detail page.

---

## 11. AI Assistant

AstraSend includes a **Claude-powered AI assistant** that helps you navigate the app.

### How to Use

1. Click the **floating chat button** (emerald circle) in the bottom-right corner of any page.
2. The chat panel opens with a greeting and **three quick questions**:
   - *"How do I send money?"*
   - *"What are the fees?"*
   - *"Which chain should I use?"*
3. Click a quick question or type your own.
4. The assistant responds in real time (streaming).
5. You can ask about:
   - How to send money, contribute, release, or claim refunds
   - Fee structure and limits
   - Base vs Unichain trade-offs
   - Transaction status and troubleshooting
   - Any AstraSend feature

### Features

- **Context-aware** — the assistant knows which chain you are connected to, whether your wallet is connected, and which page you are on.
- **Non-technical language** — designed for remittance users who may not know crypto jargon.
- **Clear chat** button (trash icon) to start a fresh conversation.
- **Collapsible** — click the X to close without losing your conversation.

---

## 12. Supported Chains

AstraSend is deployed on two testnets, with mainnet deployments ready:

| Chain | Settlement Speed | Key Advantage | Chain ID |
|-------|-----------------|---------------|----------|
| **Base Sepolia** | ~2 seconds | Testnet — use this to try AstraSend | 84532 |
| **Unichain Sepolia** | ~200ms | Testnet — fastest settlement via Flashblocks | 1301 |
| **Base** | ~2 seconds | Coinbase's L2, broad ecosystem, sub-cent gas | 8453 |
| **Unichain** | ~200ms | Uniswap's L2, MEV-protected Flashblocks | 130 |

### Why Unichain?

- **200ms Flashblocks** — near-instant settlement, so the recipient sees funds almost immediately.
- **TEE-secured block building** — Trusted Execution Environment prevents MEV attacks (front-running, sandwich attacks). Senders always get the price they expect when swapping into USDT.
- **Uniswap-aligned** — purpose-built for DeFi, with native Uniswap v4 integration.

### Switching Chains

Use your wallet's chain switcher to move between supported chains. The app detects your chain and loads the correct contract addresses automatically. Your remittances on each chain are independent.

---

## 13. Compliance & Verification

AstraSend uses **on-chain compliance** to meet regulatory requirements. The compliance module is pluggable and upgrades without redeploying the hook.

### Testnet: OpenCompliance (Current)

- **Permissionless** — all wallets can transact by default on testnet.
- Each wallet has a **daily transaction limit** (default: 10,000 USDT).
- Admins can blocklist specific addresses for fraud prevention.
- Your compliance status and remaining daily limit are shown on the Dashboard and Send page.

### Phase 1 Mainnet: AllowlistCompliance

- Users must be added to the **allowlist** by the protocol admin (after KYC verification).
- Each user has a configurable daily limit.

### Phase 2 Mainnet: World ID

- Biometric proof-of-personhood via Worldcoin's zero-knowledge proofs.
- No personal data stored on-chain — only proof that you are a unique human.
- Sybil-resistant: prevents one person from creating multiple accounts.

### What Happens If Compliance Fails

- The Send form runs a **live compliance check** as you fill it out.
- If the check fails, an amber warning appears: *"Compliance check failed for this transfer."*
- The submit button is disabled, saving you gas from a transaction that would revert.
- Common reasons: recipient is blocked, daily limit exceeded.

---

## 14. Fees & Limits

| Item | Value |
|------|-------|
| **Platform Fee** | 0.5% (50 basis points), charged at release time |
| **Gas Fees** | Typically < $0.01 on Base / Unichain |
| **Total Cost** | Under 1% all-in |
| **Minimum Send** | No protocol minimum |
| **Daily Limit** | Default 10,000 USDT per day |

### How Fees Work

- The 0.5% platform fee is deducted **only when funds are released** to the recipient.
- If a remittance is cancelled or expires, contributors get a **full refund** with zero fees.
- The fee percentage is read dynamically from the smart contract and displayed in the Send form.
- Example: sending $1,000 USDT costs $5 in platform fees. The recipient receives $995.

---

## 15. Remittance Statuses

| Status | Color | Meaning |
|--------|-------|---------|
| **Active** | Green | Open for contributions. Not yet released or cancelled. |
| **Released** | Blue | Target was met and funds were sent to the recipient. |
| **Cancelled** | Red | Creator cancelled. All contributors were refunded. |
| **Expired** | Amber | The expiry deadline passed before the target was met. Contributors can claim refunds. |

### Status Transitions

```
Active ──> Released    (target met + released by recipient or auto-release)
Active ──> Cancelled   (creator cancels)
Active ──> Expired     (expiry date passes)
```

Once a remittance is Released, Cancelled, or Expired, it cannot change status again.

---

## 16. Troubleshooting

### Common Error Messages

| Error | Meaning | What to Do |
|-------|---------|------------|
| **Compliance check failed** | Recipient is blocked or daily limit exceeded | Check remaining daily limit; contact support if blocked unexpectedly |
| **Invalid recipient address** | The address is malformed | Double-check the 0x... address |
| **You cannot send to yourself** | Sender and recipient are the same | Use a different recipient address |
| **Amount is invalid or below the minimum** | Amount too low or zero | Enter a valid amount above the minimum |
| **Expiry date must be in the future** | Expiry is in the past | Set a future expiry or leave blank |
| **This remittance is no longer active** | Trying to act on a completed remittance | The remittance was already released/cancelled/expired |
| **Only the remittance creator can do this** | Trying to cancel someone else's remittance | Only the creator can cancel |
| **Only the recipient can do this** | Trying to release as non-recipient | Only the recipient can release |
| **The target amount has not been reached** | Trying to release before target met | Wait for more contributions |
| **The recipient cannot contribute** | Recipient trying to contribute | Recipients cannot contribute to their own remittance |
| **You have no contribution to claim** | Trying to claim refund without having contributed | Only contributors can claim refunds |
| **Transaction was rejected in your wallet** | You declined the wallet popup | Re-submit and approve in your wallet |
| **Insufficient funds for gas** | Not enough ETH for gas | Add ETH to your wallet for gas fees |
| **Token balance too low** | Not enough USDT | Top up your USDT balance |

### Wallet Not Connecting?

- Make sure your wallet extension is installed and unlocked.
- Try refreshing the page.
- Switch to a supported chain (Base Sepolia or Unichain Sepolia for testnet).

### Transaction Stuck?

- Check your wallet for pending transactions.
- On Base/Unichain, transactions typically confirm in under 2 seconds.
- If using Unichain, Flashblocks confirm in ~200ms.

### Remittance Not Showing?

- Ensure you are on the correct chain. Remittances on Base are separate from Unichain.
- The Dashboard auto-refreshes every 10 seconds and also listens for real-time events.
- Try refreshing the page.

### Phone Number Not Resolving?

- Ensure the phone is in E.164 format: `+[country code][number]` with no spaces or dashes.
- The recipient must have registered their phone number via the **Receive** page first.
- Phone registration is on-chain — it requires a transaction from the recipient's wallet.

### Need More Help?

Click the **AI Assistant** (emerald chat button, bottom-right) on any page. It can answer questions about fees, how to send money, which chain to use, and more.
