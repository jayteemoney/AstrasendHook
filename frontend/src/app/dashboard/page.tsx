"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { RemittanceCard } from "@/components/remittance-card";
import { EmptyState } from "@/components/empty-state";
import { useUserRemittances } from "@/hooks/use-user-remittances";
import { useComplianceStatus } from "@/hooks/use-compliance";
import { useUSDTBalance } from "@/hooks/use-contract-write";
import { useRemittanceEvents } from "@/hooks/use-remittance-events";
import { formatUSDTDisplay, RemittanceStatus } from "@/lib/utils";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { remittances, isLoading } = useUserRemittances(address);
  const { data: complianceData } = useComplianceStatus(address);
  const { data: balance } = useUSDTBalance(address);
  const queryClient = useQueryClient();

  // Real-time event-driven updates — invalidate queries when events fire
  const handleEvent = useCallback(
    () => queryClient.invalidateQueries(),
    [queryClient]
  );
  useRemittanceEvents({ onEvent: handleEvent, address });

  if (!isConnected) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to view your dashboard.
          </p>
        </main>
      </>
    );
  }

  const activeRemittances = remittances.filter(
    (r) => r.status === RemittanceStatus.Active
  );
  const completedRemittances = remittances.filter(
    (r) => r.status !== RemittanceStatus.Active
  );

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
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
                Daily Limit Left
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {complianceData ? (
                  complianceData[0] ? (
                    `$${formatUSDTDisplay(complianceData[2] - complianceData[1])}`
                  ) : (
                    <span className="text-red-500">Blocked</span>
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

          {/* Compliance Roadmap */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Compliance Roadmap
            </h2>
            <div className="relative space-y-0">
              {/* Connector line */}
              <div className="absolute left-4 top-5 h-[calc(100%-40px)] w-px bg-zinc-200 dark:bg-zinc-700" />

              {[
                {
                  phase: "Now",
                  label: "OpenCompliance (Testnet)",
                  status: "active",
                  desc: "Permissionless — all wallets can transact. Blocklist for fraud prevention. 10,000 USDT daily limit per wallet.",
                  badge: "Live on testnet",
                  badgeColor: "emerald",
                },
                {
                  phase: "Phase 1",
                  label: "AllowlistCompliance",
                  status: "ready",
                  desc: "KYC-gated allowlist. Admin approves wallets after identity verification. Per-user configurable daily limits. Contract deployed and audited.",
                  badge: "Ready to deploy",
                  badgeColor: "blue",
                },
                {
                  phase: "Phase 2",
                  label: "WorldcoinCompliance",
                  status: "built",
                  desc: "Biometric proof-of-personhood via World ID. Zero-knowledge iris scan — no personal data on-chain. Sybil-resistant: one account per human. Hot-swappable with no hook redeployment.",
                  badge: "Built",
                  badgeColor: "violet",
                },
              ].map(({ phase, label, status, desc, badge, badgeColor }) => (
                <div key={phase} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white dark:border-zinc-900 dark:bg-zinc-900">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        status === "active"
                          ? "bg-emerald-500"
                          : status === "ready"
                            ? "bg-blue-500"
                            : "bg-violet-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                        {phase}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          badgeColor === "emerald"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : badgeColor === "blue"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                        }`}
                      >
                        {badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
              Compliance modules are hot-swappable — upgrading requires only a
              single admin call to{" "}
              <span className="font-mono">setCompliance(newModule)</span>. The
              hook contract never needs redeployment.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
