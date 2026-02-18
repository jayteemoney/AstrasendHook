"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  useContributeDirectly,
  useApproveUSDT,
  useUSDTAllowance,
  useUSDTBalance,
} from "@/hooks/use-contract-write";
import { parseUSDT, formatUSDT, formatUSDTDisplay } from "@/lib/utils";

interface ContributeFormProps {
  remittanceId: bigint;
  targetAmount: bigint;
  currentAmount: bigint;
  onSuccess?: () => void;
}

export function ContributeForm({
  remittanceId,
  targetAmount,
  currentAmount,
  onSuccess,
}: ContributeFormProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");

  const { data: balance } = useUSDTBalance(address);
  const { data: allowance, refetch: refetchAllowance } =
    useUSDTAllowance(address);

  const {
    approve,
    isPending: isApproving,
    isConfirming: isApprovingConfirm,
    isSuccess: approveSuccess,
    error: approveError,
    reset: resetApprove,
  } = useApproveUSDT();

  const {
    contribute,
    isPending: isContributing,
    isConfirming: isContributingConfirm,
    isSuccess: contributeSuccess,
    error: contributeError,
    reset: resetContribute,
  } = useContributeDirectly();

  const remaining = targetAmount - currentAmount;
  const parsedAmount = amount ? parseUSDT(amount) : 0n;
  const needsApproval = allowance !== undefined && parsedAmount > allowance;

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
    }
  }, [approveSuccess, refetchAllowance]);

  useEffect(() => {
    if (contributeSuccess) {
      setAmount("");
      onSuccess?.();
    }
  }, [contributeSuccess, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parsedAmount === 0n) return;

    if (needsApproval) {
      approve(parsedAmount);
    } else {
      contribute(remittanceId, parsedAmount);
    }
  };

  const fillRemaining = () => {
    setAmount(formatUSDT(remaining));
    resetApprove();
    resetContribute();
  };

  const error = approveError || contributeError;
  const isLoading =
    isApproving || isApprovingConfirm || isContributing || isContributingConfirm;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="contribute-amount"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Contribution Amount (USDT)
          </label>
          {balance !== undefined && (
            <span className="text-xs text-zinc-500">
              Balance: ${formatUSDTDisplay(balance)}
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            $
          </span>
          <input
            id="contribute-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              resetApprove();
              resetContribute();
            }}
            placeholder="0.00"
            className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-8 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
          />
        </div>
        {remaining > 0n && (
          <button
            type="button"
            onClick={fillRemaining}
            className="mt-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Fill remaining: ${formatUSDTDisplay(remaining)}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error.message.includes("User rejected")
            ? "Transaction was rejected"
            : error.message.slice(0, 200)}
        </div>
      )}

      {contributeSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
          Contribution successful!
        </div>
      )}

      <button
        type="submit"
        disabled={!amount || parsedAmount === 0n || isLoading}
        className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isApproving || isApprovingConfirm
          ? "Approving USDT..."
          : isContributing || isContributingConfirm
            ? "Contributing..."
            : needsApproval
              ? "Approve & Contribute"
              : "Contribute"}
      </button>
    </form>
  );
}
