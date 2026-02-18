"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { StatusBadge } from "./status-badge";
import type { RemittanceView } from "@/hooks/use-remittance";
import {
  formatUSDTDisplay,
  shortenAddress,
  timeAgo,
  timeUntil,
  progressPercent,
  RemittanceStatus,
} from "@/lib/utils";

export function RemittanceCard({ remittance }: { remittance: RemittanceView }) {
  const { address } = useAccount();
  const progress = progressPercent(
    remittance.currentAmount,
    remittance.targetAmount
  );
  const isCreator =
    address?.toLowerCase() === remittance.creator.toLowerCase();
  const isRecipient =
    address?.toLowerCase() === remittance.recipient.toLowerCase();

  return (
    <Link
      href={`/remittance/${remittance.id.toString()}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500">
              #{remittance.id.toString()}
            </span>
            <StatusBadge status={remittance.status} />
            {isCreator && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Sent
              </span>
            )}
            {isRecipient && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                Receiving
              </span>
            )}
          </div>

          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              ${formatUSDTDisplay(remittance.currentAmount)}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-500">
              / ${formatUSDTDisplay(remittance.targetAmount)}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
            <span>
              To: {shortenAddress(remittance.recipient)}
            </span>
            <span>{timeAgo(remittance.createdAt)}</span>
            {remittance.expiresAt > 0n &&
              remittance.status === RemittanceStatus.Active && (
                <span>{timeUntil(remittance.expiresAt)}</span>
              )}
            {remittance.contributorList.length > 0 && (
              <span>
                {remittance.contributorList.length} contributor
                {remittance.contributorList.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      {remittance.status === RemittanceStatus.Active && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-zinc-400">
            {progress.toFixed(1)}%
          </div>
        </div>
      )}
    </Link>
  );
}
