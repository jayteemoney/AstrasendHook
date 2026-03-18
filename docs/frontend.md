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

Create `frontend/.env` (or `.env.local`):

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# RPC URLs (optional — defaults to public endpoints)
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_UNICHAIN_RPC_URL=https://mainnet.unichain.org
NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC_URL=https://sepolia.unichain.org

# AI assistant (Hugging Face)
HUGGINGFACE_API_KEY=your_huggingface_api_key
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
│       └── chat/route.ts       # AI assistant streaming endpoint (Hugging Face)
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
│   └── ai-assistant.tsx        # Floating AI chat widget (Qwen 2.5 72B via Hugging Face)
├── hooks/
│   ├── use-remittance.ts       # useRemittance, useContribution, usePlatformFee, useNextRemittanceId
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

- Recipient field accepts wallet addresses (`0x...`)
- Live pre-send compliance check — disables submit if recipient is blocked or limit exceeded
- Multi-step flow: approve USDT → create remittance → contribute funds (with animated progress indicator)
- Decodes actual remittance ID from `RemittanceCreated` event in receipt before contributing
- Fee breakdown updates live as amount changes
- Submit button shows "Loading..." while USDT balance and next remittance ID are fetching

### `phone-registration.tsx`

- Standalone component on the Receive page
- E.164 phone validation (`+[country code][number]`)
- `useRegisterPhoneString` — calls `PhoneNumberResolver.registerPhoneString(phone, wallet)`
- Caller must be the wallet being registered (enforced by the contract)

### `ai-assistant.tsx`

AstraSend's built-in AI assistant is a first-class product feature, not a bolt-on. It is mounted globally in `layout.tsx` so it is available on every page without any navigation.

**Model:** Qwen/Qwen2.5-72B-Instruct via Hugging Face inference API (`router.huggingface.co/v1/chat/completions`)
**API route:** `frontend/src/app/api/chat/route.ts` — server-side streaming, 15s timeout, SSE response
**Config:** `HUGGINGFACE_API_KEY` in `.env`

**Key capabilities:**
- Streaming responses — text appears token by token, no waiting for full response
- Context-aware system prompt — the client passes `{ chainId, isConnected, currentPage }` with every request; the system prompt adapts so the assistant knows whether to explain Base vs Unichain, whether to suggest connecting a wallet, and which features are relevant to the current page
- Ten suggested question chips on open, covering the most common user questions (fees, how to send, phone mode, group contributions, swap contribution mechanic, compliance roadmap, chain selection)
- Knows about every AstraSend feature: phone mode, `afterSwapReturnDelta` swap contributions, the 3-phase compliance roadmap, group funding, daily limits, auto-release
- Designed for non-crypto users — answers in plain language, explains gas and wallet concepts briefly when needed
- Collapsible and stateful — conversation persists until explicitly cleared

**Why this matters:** AstraSend's target users — migrant workers sending money home — are not DeFi-native. The assistant removes the friction of reading documentation and lets users ask questions in natural language at the exact moment they are confused. No other remittance hook submission includes this layer.

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
useCreateRemittance()          // create(recipient, targetAmount, expiresAt, purposeHash, autoRelease)
useCreateRemittanceByPhone()   // createByPhone(recipientPhoneHash, targetAmount, expiresAt, purposeHash, autoRelease)
useContributeDirectly()        // contribute(remittanceId, amount)
useReleaseRemittance()         // release(remittanceId)
useCancelRemittance()          // cancel(remittanceId)
useClaimExpiredRefund()        // claim(remittanceId)
useApproveUSDT()               // approve(amount) — approves the hook to spend USDT
useUSDTBalance(address)        // → bigint: USDT balance
useUSDTAllowance(owner)        // → bigint: current USDT allowance for the hook
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
