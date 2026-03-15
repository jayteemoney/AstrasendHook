# Frontend Guide — AstraSend

Next.js 16 frontend for the AstraSend Uniswap v4 remittance hook.

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16 | App router, React Server Components |
| wagmi | v3 | Ethereum hooks (read/write contracts, watch events) |
| connectkit | latest | Wallet connection UI |
| viem | v2 | Low-level Ethereum client |
| TanStack Query | v5 | Server state, caching, refetch |
| Tailwind CSS | v4 | Utility-first styling |

---

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key     # optional, for RPC
ANTHROPIC_API_KEY=your_anthropic_key                 # for AI assistant
```

WalletConnect Project ID is required for WalletConnect-compatible wallets. Get one at [cloud.walletconnect.com](https://cloud.walletconnect.com).

---

## Project Structure

```
frontend/src/
├── app/
│   ├── layout.tsx              # Root layout: providers, header, AI assistant
│   ├── page.tsx                # Landing page
│   ├── dashboard/page.tsx      # Wallet-gated dashboard
│   ├── send/page.tsx           # Send remittance
│   ├── receive/page.tsx        # Phone registration + incoming remittances
│   ├── history/page.tsx        # Transaction history
│   ├── remittance/[id]/page.tsx # Remittance detail
│   └── api/
│       └── assistant/route.ts  # Claude AI streaming endpoint
├── components/
│   ├── logo.tsx                # LogoMark SVG component (globe + arrow)
│   ├── header.tsx              # Top nav with wallet connect
│   ├── providers.tsx           # wagmi + connectkit + query providers
│   ├── landing/                # Landing page sections
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── how-it-works.tsx
│   │   ├── comparison.tsx
│   │   ├── tech-stack.tsx
│   │   ├── faq.tsx
│   │   └── footer.tsx
│   ├── send-form.tsx           # Main send form (address/phone toggle)
│   ├── phone-registration.tsx  # Phone number registration UI
│   ├── remittance-card.tsx     # Remittance list item
│   ├── remittance-detail.tsx   # Full detail + actions (release/cancel/refund)
│   └── ai-assistant.tsx        # Claude-powered floating chat widget
├── hooks/
│   ├── use-remittance.ts       # useRemittance, useContribution, usePlatformFee
│   ├── use-remittance-events.ts# Real-time event listener (RemittanceCreated, etc.)
│   ├── use-contract-write.ts   # useCreateRemittance, useContribute, useRelease, useCancel
│   ├── use-compliance.ts       # useComplianceStatus, useRemainingDailyLimit, useIsBlocked
│   └── use-phone-resolver.ts   # useHasPhone, useRegisterPhoneString, useResolvePhoneString
├── config/
│   └── contracts.ts            # Contract addresses + ABIs by chain ID
└── lib/
    └── utils.ts                # cn(), formatUSDT(), truncateAddress()
```

---

## Contract Configuration

All contract addresses and ABIs are in `src/config/contracts.ts`.

To update for a new deployment:

```typescript
export const CONTRACT_ADDRESSES = {
  84532: {  // Base Sepolia
    astraSendHook: "0x..." as Address,
    compliance:    "0x..." as Address,
    phoneResolver: "0x..." as Address,
    usdt:          "0x..." as Address,
  },
  1301: {   // Unichain Sepolia
    astraSendHook: "0x..." as Address,
    compliance:    "0x..." as Address,
    phoneResolver: "0x..." as Address,
    usdt:          "0x..." as Address,
  },
  8453: {   // Base Mainnet
    astraSendHook: "0x..." as Address,
    compliance:    "0x..." as Address,
    phoneResolver: "0x..." as Address,
    usdt:          "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
  },
};
```

---

## Key Components

### `send-form.tsx`

- Recipient field auto-detects input: `0x...` → address mode, `+...` → phone mode
- Phone mode resolves to wallet via `useResolvePhoneString`, shows resolved address preview
- Live pre-send compliance check — disables submit if recipient is blocked or limit exceeded
- Fee breakdown updates live as amount changes
- Requires USDT approval before first contribution

### `phone-registration.tsx`

- Standalone component on the Receive page
- E.164 phone validation (`+[country code][number]`)
- `useRegisterPhoneString` — calls `PhoneNumberResolver.registerPhoneString(phone, wallet)`
- Caller must be the wallet being registered (enforced by the contract)

### `ai-assistant.tsx`

- Floating chat widget mounted globally in `layout.tsx`
- Streams responses from `/api/assistant` (Claude claude-sonnet-4-6)
- Context-aware: passes chain ID, wallet connection state, current page
- Three quick-question buttons on open

### `remittance-detail.tsx`

- Shows status, progress bar, contributor list
- Release button (recipient only, when target met + manual release)
- Cancel button (creator only, when Active)
- Claim refund button (contributors, when Expired)
- Real-time updates via `useRemittanceEvents`

---

## Hooks

### `use-phone-resolver.ts`

```typescript
useHasPhone(address)          // → boolean: has the wallet registered a phone?
useRegisterPhoneString()      // → write hook for registerPhoneString(phone, wallet)
useResolvePhoneString(phone)  // → resolved wallet address or undefined
useComputePhoneHash(phone)    // → keccak256 hash of the phone number
useIsPhoneRegistered(phone)   // → boolean: is this phone number taken?
```

### `use-compliance.ts`

```typescript
useComplianceStatus(address)  // → { isAllowed, dailyLimit, usedToday }
useRemainingDailyLimit(address) // → bigint: USDT remaining today
useIsBlocked(address)         // → boolean
useIsCompliant(sender, recipient, amount) // → boolean: full check
```

### `use-contract-write.ts`

```typescript
useCreateRemittance()         // createRemittance(recipient, token, amount, expiry, purpose, autoRelease)
useCreateRemittanceByPhone()  // createRemittanceByPhone(phone, token, amount, expiry, purpose, autoRelease)
useContribute(remittanceId)   // contribute(id, amount)
useReleaseRemittance(id)      // release(id)
useCancelRemittance(id)       // cancel(id)
useClaimRefund(id)            // claimRefund(id)
useUSDTBalance(address)       // → bigint: USDT balance
```

---

## Building for Production

```bash
cd frontend
npm run build
npm start
```

Or deploy to Vercel — connect the repo and set `frontend` as the root directory.

---

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Base Sepolia | 84532 | Live (testnet) |
| Unichain Sepolia | 1301 | Live (testnet) |
| Base Mainnet | 8453 | Ready (awaiting mainnet deploy) |
| Unichain Mainnet | 130 | Ready (awaiting mainnet deploy) |

The app reads `useChainId()` and loads the matching contract addresses automatically. Unknown chains show a "Switch Network" prompt.
