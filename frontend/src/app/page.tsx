"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Header } from "@/components/header";
import { RemittanceCard } from "@/components/remittance-card";
import { EmptyState } from "@/components/empty-state";
import { useUserRemittances } from "@/hooks/use-user-remittances";
import { useComplianceStatus } from "@/hooks/use-compliance";
import { useUSDTBalance } from "@/hooks/use-contract-write";
import { formatUSDTDisplay, RemittanceStatus } from "@/lib/utils";

function Dashboard() {
  const { address } = useAccount();
  const { remittances, isLoading } = useUserRemittances(address);
  const { data: complianceData } = useComplianceStatus(address);
  const { data: balance } = useUSDTBalance(address);

  const activeRemittances = remittances.filter(
    (r) => r.status === RemittanceStatus.Active
  );
  const completedRemittances = remittances.filter(
    (r) => r.status !== RemittanceStatus.Active
  );

  return (
    <div className="space-y-8">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            USDT Balance
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            ${balance !== undefined ? formatUSDTDisplay(balance) : "---"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Active Remittances
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {activeRemittances.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Compliance
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {complianceData ? (
              complianceData[0] ? (
                <span className="text-emerald-600">Verified</span>
              ) : (
                <span className="text-red-500">Not Verified</span>
              )
            ) : (
              <span className="text-zinc-400">---</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/send"
          className="flex-1 rounded-xl bg-emerald-600 px-6 py-4 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Send Money
        </Link>
        <Link
          href="/receive"
          className="flex-1 rounded-xl border border-zinc-200 bg-white px-6 py-4 text-center text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Receive
        </Link>
      </div>

      {/* Active remittances */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Active Remittances
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : activeRemittances.length > 0 ? (
          <div className="space-y-3">
            {activeRemittances.map((r) => (
              <RemittanceCard key={r.id.toString()} remittance={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active remittances"
            description="Create your first remittance to send money across borders with fees under 1%."
            actionLabel="Send Money"
            actionHref="/send"
          />
        )}
      </section>

      {/* Recent completed */}
      {completedRemittances.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Activity
            </h2>
            <Link
              href="/history"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {completedRemittances.slice(0, 3).map((r) => (
              <RemittanceCard key={r.id.toString()} remittance={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LandingHero() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white">
        R
      </div>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-100">
        Send money anywhere.
        <br />
        <span className="text-emerald-600">Under 1% fees.</span>
      </h1>
      <p className="mt-4 max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
        RemitSwap uses Uniswap v4 hooks for low-cost, compliant cross-border
        remittances. Group contributions, auto-release, and instant settlement
        on Base.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
        <ConnectKitButton />
      </div>
      <div className="mt-16 grid max-w-3xl grid-cols-1 gap-8 text-left sm:grid-cols-3">
        <div>
          <div className="mb-2 text-2xl font-bold text-emerald-600">
            &lt; 1%
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Total Fees
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            vs. 6-15% with traditional services like Western Union
          </p>
        </div>
        <div>
          <div className="mb-2 text-2xl font-bold text-emerald-600">
            Instant
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Settlement
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            No 3-5 business day waits. Funds arrive in seconds on Base L2.
          </p>
        </div>
        <div>
          <div className="mb-2 text-2xl font-bold text-emerald-600">
            Compliant
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            KYC / World ID
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            On-chain compliance with allowlist or Worldcoin proof-of-personhood.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();

  return isConnected ? (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Dashboard />
      </main>
    </>
  ) : (
    <>
      <Header />
      <LandingHero />
    </>
  );
}
