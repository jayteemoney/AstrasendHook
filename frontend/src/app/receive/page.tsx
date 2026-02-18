"use client";

import { useAccount } from "wagmi";
import { Header } from "@/components/header";
import { RemittanceCard } from "@/components/remittance-card";
import { EmptyState } from "@/components/empty-state";
import { useRecipientRemittanceIds, useRemittancesBatch } from "@/hooks/use-user-remittances";
import type { RemittanceView } from "@/hooks/use-remittance";
import { RemittanceStatus } from "@/lib/utils";

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
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to view incoming remittances.
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
            Incoming Remittances
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Remittances where you are the recipient. Release funds once the
            target is met.
          </p>
        </div>

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
              <section>
                <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-500">
                  Pending ({activeIncoming.length})
                </h2>
                <div className="space-y-3">
                  {activeIncoming.map((r) => (
                    <RemittanceCard key={r.id.toString()} remittance={r} />
                  ))}
                </div>
              </section>
            )}

            {completedIncoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-500">
                  Completed ({completedIncoming.length})
                </h2>
                <div className="space-y-3">
                  {completedIncoming.map((r) => (
                    <RemittanceCard key={r.id.toString()} remittance={r} />
                  ))}
                </div>
              </section>
            )}

            {remittances.length === 0 && (
              <EmptyState
                title="No incoming remittances"
                description="When someone sends you a remittance, it will appear here."
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
