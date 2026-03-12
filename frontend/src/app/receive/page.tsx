"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import { RemittanceCard } from "@/components/remittance-card";
import { EmptyState } from "@/components/empty-state";
import { useRecipientRemittanceIds, useRemittancesBatch } from "@/hooks/use-user-remittances";
import type { RemittanceView } from "@/hooks/use-remittance";
import { RemittanceStatus, shortenAddress } from "@/lib/utils";

export default function ReceivePage() {
  const { address, isConnected } = useAccount();
  const { data: recipientIds, isLoading: loadingIds } =
    useRecipientRemittanceIds(address);
  const { data: results, isLoading: loadingDetails } =
    useRemittancesBatch(recipientIds);

  const remittances: RemittanceView[] = (results ?? [])
    .filter((r) => r.status === "success" && r.result)
    .map((r) => r.result as unknown as RemittanceView)
    .sort((a, b) => Number(b.createdAt - a.createdAt));

  const activeIncoming = remittances.filter(
    (r) => r.status === RemittanceStatus.Active
  );
  const completedIncoming = remittances.filter(
    (r) => r.status !== RemittanceStatus.Active
  );

  const isLoading = loadingIds || loadingDetails;

  if (!isConnected) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to set up receiving.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6 sm:py-8">
        <div className="space-y-8">
          {/* Setup section */}
          <section>
            <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Receive Money
            </h1>
            <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
              Share your wallet address so anyone can send you money.
            </p>

            {address && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Your wallet address
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-white px-3 py-2 text-xs font-mono text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                    {address}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(address)}
                    className="flex-shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-600">
                  Shortened: {shortenAddress(address)}
                </p>
              </div>
            )}
          </section>

          {/* Incoming remittances */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Incoming Remittances
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
            ) : (
              <div className="space-y-8">
                {activeIncoming.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-500">
                      Pending ({activeIncoming.length})
                    </p>
                    <div className="space-y-3">
                      {activeIncoming.map((r) => (
                        <RemittanceCard key={r.id.toString()} remittance={r} />
                      ))}
                    </div>
                  </div>
                )}

                {completedIncoming.length > 0 && (
                  <div>
                    <p className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-500">
                      Completed ({completedIncoming.length})
                    </p>
                    <div className="space-y-3">
                      {completedIncoming.map((r) => (
                        <RemittanceCard key={r.id.toString()} remittance={r} />
                      ))}
                    </div>
                  </div>
                )}

                {remittances.length === 0 && (
                  <EmptyState
                    title="No incoming remittances"
                    description="When someone sends you a remittance, it will appear here."
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
