"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { useRemittanceEvents } from "@/hooks/use-remittance-events";
import { Header } from "@/components/header";
import { StatusBadge } from "@/components/status-badge";
import { ContributeForm } from "@/components/contribute-form";
import { useRemittance, useContribution } from "@/hooks/use-remittance";
import {
  useReleaseRemittance,
  useCancelRemittance,
  useClaimExpiredRefund,
} from "@/hooks/use-contract-write";
import {
  formatUSDTDisplay,
  shortenAddress,
  timeAgo,
  timeUntil,
  progressPercent,
  RemittanceStatus,
  decodeContractError,
  getExplorerTxUrl,
} from "@/lib/utils";

export default function RemittanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const remittanceId = BigInt(id);
  const { address, isConnected } = useAccount();

  const {
    data: remittance,
    isLoading,
    refetch,
  } = useRemittance(remittanceId);
  const { data: myContribution } = useContribution(remittanceId, address);

  const chainId = useChainId();

  const {
    release,
    hash: releaseHash,
    isPending: isReleasing,
    isConfirming: isReleasingConfirm,
    isSuccess: releaseSuccess,
    error: releaseError,
  } = useReleaseRemittance();
  const {
    cancel,
    hash: cancelHash,
    isPending: isCancelling,
    isConfirming: isCancellingConfirm,
    isSuccess: cancelSuccess,
    error: cancelError,
  } = useCancelRemittance();
  const {
    claim,
    hash: claimHash,
    isPending: isClaiming,
    isConfirming: isClaimingConfirm,
    isSuccess: claimSuccess,
    error: claimError,
  } = useClaimExpiredRefund();

  // Real-time event updates for this specific remittance
  const handleEvent = useCallback(() => refetch(), [refetch]);
  useRemittanceEvents({ onEvent: handleEvent, remittanceId });

  if (!isConnected) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-zinc-500">
            Connect your wallet to view remittance details.
          </p>
        </main>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </main>
      </>
    );
  }

  if (!remittance || remittance.id === 0n) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Remittance not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            This remittance does not exist or has not been created yet.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Back to Dashboard
          </Link>
        </main>
      </>
    );
  }

  const isCreator =
    address?.toLowerCase() === remittance.creator.toLowerCase();
  const isRecipient =
    address?.toLowerCase() === remittance.recipient.toLowerCase();
  const progress = progressPercent(
    remittance.currentAmount,
    remittance.targetAmount
  );
  const isActive = remittance.status === RemittanceStatus.Active;
  const targetMet = remittance.currentAmount >= remittance.targetAmount;
  const isExpired =
    remittance.expiresAt > 0n &&
    BigInt(Math.floor(Date.now() / 1000)) >= remittance.expiresAt;
  const canRelease = isRecipient && isActive && targetMet;
  const canCancel = isCreator && isActive;
  const canClaimRefund =
    isExpired &&
    myContribution !== undefined &&
    myContribution > 0n &&
    (remittance.status === RemittanceStatus.Active ||
      remittance.status === RemittanceStatus.Expired);
  const canContribute =
    isActive && !isRecipient && !isExpired;

  const actionError = releaseError || cancelError || claimError;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 4l-4 4 4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Remittance #{remittance.id.toString()}
              </h1>
              <StatusBadge status={remittance.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Created {timeAgo(remittance.createdAt)}
              {remittance.expiresAt > 0n && (
                <span> &middot; {timeUntil(remittance.expiresAt)}</span>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main info */}
          <div className="space-y-6 lg:col-span-3">
            {/* Amount card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  ${formatUSDTDisplay(remittance.currentAmount)}
                </span>
                <span className="text-lg text-zinc-500">
                  / ${formatUSDTDisplay(remittance.targetAmount)} USDT
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      targetMet ? "bg-emerald-500" : "bg-emerald-400"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{progress.toFixed(1)}% funded</span>
                  {targetMet && (
                    <span className="font-medium text-emerald-600">
                      Target reached!
                    </span>
                  )}
                </div>
              </div>

              {/* Fee breakdown */}
              {targetMet && isActive && (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Fee ({Number(remittance.platformFeeBps) / 100}%)</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      -$
                      {formatUSDTDisplay(
                        (remittance.currentAmount * remittance.platformFeeBps) /
                          10000n
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Recipient receives
                    </span>
                    <span className="font-semibold text-emerald-600">
                      $
                      {formatUSDTDisplay(
                        remittance.currentAmount -
                          (remittance.currentAmount *
                            remittance.platformFeeBps) /
                            10000n
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Details
              </h2>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-zinc-500">Creator</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {isCreator ? "You" : shortenAddress(remittance.creator)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-zinc-500">Recipient</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {isRecipient ? "You" : shortenAddress(remittance.recipient)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-zinc-500">Auto-release</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {remittance.autoRelease ? "Enabled" : "Disabled"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-zinc-500">Contributors</dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {remittance.contributorList.length}
                  </dd>
                </div>
                {myContribution !== undefined && myContribution > 0n && (
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-zinc-500">
                      Your contribution
                    </dt>
                    <dd className="text-sm font-semibold text-emerald-600">
                      ${formatUSDTDisplay(myContribution)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Contributors list */}
              {remittance.contributorList.length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <h3 className="mb-2 text-xs font-medium text-zinc-500">
                    Contributors
                  </h3>
                  <div className="space-y-1.5">
                    {remittance.contributorList.map((addr) => (
                      <div
                        key={addr}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-zinc-600 dark:text-zinc-400">
                          {addr.toLowerCase() === address?.toLowerCase()
                            ? "You"
                            : shortenAddress(addr)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions sidebar */}
          <div className="space-y-4 lg:col-span-2">
            {/* Contribute */}
            {canContribute && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Contribute
                </h2>
                <ContributeForm
                  remittanceId={remittance.id}
                  targetAmount={remittance.targetAmount}
                  currentAmount={remittance.currentAmount}
                  onSuccess={() => refetch()}
                />
              </div>
            )}

            {/* Release */}
            {canRelease && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-900/20">
                <h2 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Ready to Release
                </h2>
                <p className="mb-4 text-xs text-emerald-700 dark:text-emerald-400">
                  The target amount has been reached. Release funds to your
                  wallet.
                </p>
                <button
                  onClick={() => release(remittance.id)}
                  disabled={isReleasing || isReleasingConfirm}
                  className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isReleasing
                    ? "Confirm in Wallet..."
                    : isReleasingConfirm
                      ? "Releasing..."
                      : "Release Funds"}
                </button>
                {releaseSuccess && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Funds released successfully!{" "}
                    {releaseHash && (
                      <a href={getExplorerTxUrl(chainId, releaseHash)} target="_blank" rel="noopener noreferrer" className="underline">
                        View transaction
                      </a>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Cancel */}
            {canCancel && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Cancel Remittance
                </h2>
                <p className="mb-4 text-xs text-zinc-500">
                  Cancel this remittance and refund all contributors.
                </p>
                <button
                  onClick={() => cancel(remittance.id)}
                  disabled={isCancelling || isCancellingConfirm}
                  className="w-full rounded-lg border border-red-300 bg-white py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:hover:bg-red-900/20"
                >
                  {isCancelling
                    ? "Confirm in Wallet..."
                    : isCancellingConfirm
                      ? "Cancelling..."
                      : "Cancel & Refund"}
                </button>
                {cancelSuccess && (
                  <p className="mt-2 text-xs text-red-600">
                    Remittance cancelled. Contributors have been refunded.{" "}
                    {cancelHash && (
                      <a href={getExplorerTxUrl(chainId, cancelHash)} target="_blank" rel="noopener noreferrer" className="underline">
                        View transaction
                      </a>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Claim expired refund */}
            {canClaimRefund && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-900/20">
                <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Expired - Claim Refund
                </h2>
                <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
                  This remittance has expired. Claim your contribution back.
                </p>
                <button
                  onClick={() => claim(remittance.id)}
                  disabled={isClaiming || isClaimingConfirm}
                  className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {isClaiming
                    ? "Confirm in Wallet..."
                    : isClaimingConfirm
                      ? "Claiming..."
                      : `Claim $${formatUSDTDisplay(myContribution!)} Refund`}
                </button>
                {claimSuccess && (
                  <p className="mt-2 text-xs text-amber-600">
                    Refund claimed successfully!{" "}
                    {claimHash && (
                      <a href={getExplorerTxUrl(chainId, claimHash)} target="_blank" rel="noopener noreferrer" className="underline">
                        View transaction
                      </a>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Status: Released */}
            {remittance.status === RemittanceStatus.Released && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-900/20">
                <h2 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  Funds Released
                </h2>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                  This remittance has been completed. Funds were sent to the
                  recipient.
                </p>
              </div>
            )}

            {/* Status: Cancelled */}
            {remittance.status === RemittanceStatus.Cancelled && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-900/20">
                <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Cancelled
                </h2>
                <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                  This remittance was cancelled. All contributors have been
                  refunded.
                </p>
              </div>
            )}

            {/* Error display */}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
                {decodeContractError(actionError)}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
