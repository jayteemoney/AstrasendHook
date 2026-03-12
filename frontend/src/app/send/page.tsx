"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import { SendForm } from "@/components/send-form";

export default function SendPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to send remittances.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Send Money
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Create a remittance to send USDT to anyone with fees under 1%.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <SendForm />
        </div>

        {/* Info cards */}
        <div className="mt-6 space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              How it works
            </h3>
            <ol className="mt-2 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-500">
              <li>1. Create a remittance with a target amount and recipient</li>
              <li>
                2. You or others can contribute USDT directly or via Uniswap
                swaps
              </li>
              <li>
                3. When the target is met, funds auto-release to the recipient
                (minus 0.5% fee)
              </li>
              <li>
                4. Or the recipient can manually release once target is reached
              </li>
            </ol>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
            <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Group Contributions
            </h3>
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
              Multiple people can contribute to the same remittance. Share the
              remittance link so family members or friends can pool funds for
              a single recipient.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
