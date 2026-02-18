"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import { RemittanceCard } from "@/components/remittance-card";
import { EmptyState } from "@/components/empty-state";
import { useUserRemittances } from "@/hooks/use-user-remittances";
import { RemittanceStatus } from "@/lib/utils";

type Filter = "all" | "active" | "released" | "cancelled" | "expired";

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const { remittances, isLoading } = useUserRemittances(address);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = remittances.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return r.status === RemittanceStatus.Active;
    if (filter === "released") return r.status === RemittanceStatus.Released;
    if (filter === "cancelled") return r.status === RemittanceStatus.Cancelled;
    if (filter === "expired") return r.status === RemittanceStatus.Expired;
    return true;
  });

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "released", label: "Released" },
    { value: "cancelled", label: "Cancelled" },
    { value: "expired", label: "Expired" },
  ];

  if (!isConnected) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to view your history.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Transaction History
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            All your remittances, sent and received.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((r) => (
              <RemittanceCard key={r.id.toString()} remittance={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              filter === "all"
                ? "No remittances yet"
                : `No ${filter} remittances`
            }
            description={
              filter === "all"
                ? "Create your first remittance to get started."
                : "Try a different filter or create a new remittance."
            }
            actionLabel={filter === "all" ? "Send Money" : undefined}
            actionHref={filter === "all" ? "/send" : undefined}
          />
        )}
      </main>
    </>
  );
}
