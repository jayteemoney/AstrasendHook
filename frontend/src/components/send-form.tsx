"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { isAddress, keccak256, toBytes } from "viem";
import {
  useCreateRemittance,
  useContributeDirectly,
  useApproveUSDT,
  useUSDTAllowance,
  useUSDTBalance,
} from "@/hooks/use-contract-write";
import { useComplianceStatus, useIsCompliant, useRemainingDailyLimit } from "@/hooks/use-compliance";
import { usePlatformFee, useNextRemittanceId } from "@/hooks/use-remittance";
import { parseUSDT, formatUSDTDisplay, decodeContractError, getExplorerTxUrl } from "@/lib/utils";

type Step = "idle" | "approving" | "approved" | "creating" | "contributing" | "done";

export function SendForm() {
  const { address } = useAccount();
  const chainId = useChainId();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [purpose, setPurpose] = useState("");
  const [autoRelease, setAutoRelease] = useState(true);
  const [step, setStep] = useState<Step>("idle");

  // Store the predicted remittance ID so we can contribute after create confirms
  const predictedIdRef = useRef<bigint | null>(null);

  // Platform fee
  const { data: platformFeeBps } = usePlatformFee();
  const feePct = platformFeeBps !== undefined ? Number(platformFeeBps) / 100 : 0.5;
  const feeDecimal = feePct / 100;

  // Compliance
  const { data: complianceData } = useComplianceStatus(address);
  const { data: remainingLimit } = useRemainingDailyLimit(address);

  // USDT balance & allowance
  const { data: balance } = useUSDTBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDTAllowance(address);

  // Next remittance ID (to predict the ID before creating)
  const { data: nextId } = useNextRemittanceId();

  // Resolved recipient
  const resolvedRecipient = useMemo(() => {
    if (isAddress(recipient)) return recipient as `0x${string}`;
    return undefined;
  }, [recipient]);

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amount);
    return val > 0 ? parseUSDT(amount) : undefined;
  }, [amount]);

  const { data: isCompliant, isLoading: checkingCompliance } = useIsCompliant(
    address,
    resolvedRecipient,
    parsedAmount
  );

  // Contract write hooks
  const {
    approve,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
    reset: resetApprove,
  } = useApproveUSDT();

  const {
    create,
    isPending: createPending,
    isConfirming: createConfirming,
    isSuccess: createSuccess,
    error: createError,
    reset: resetCreate,
  } = useCreateRemittance();

  const {
    contribute,
    hash: contributeHash,
    isPending: contributePending,
    isConfirming: contributeConfirming,
    isSuccess: contributeSuccess,
    error: contributeError,
    reset: resetContribute,
  } = useContributeDirectly();

  // ── Step machine ──────────────────────────────────────────────────

  // After approval confirms → proceed to create
  useEffect(() => {
    if (approveSuccess && step === "approving") {
      refetchAllowance();
      setStep("approved");
    }
  }, [approveSuccess, step, refetchAllowance]);

  // After create confirms → auto-contribute
  useEffect(() => {
    if (createSuccess && (step === "creating") && predictedIdRef.current !== null) {
      setStep("contributing");
      contribute(predictedIdRef.current, parsedAmount!);
    }
  }, [createSuccess, step, contribute, parsedAmount]);

  // After contribute confirms → done
  useEffect(() => {
    if (contributeSuccess && step === "contributing") {
      setStep("done");
    }
  }, [contributeSuccess, step]);

  // ── Handlers ─────────────────────────────────────────────────────

  const resetAll = () => {
    resetApprove();
    resetCreate();
    resetContribute();
    setStep("idle");
    predictedIdRef.current = null;
  };

  const handleNewTransfer = () => {
    resetAll();
    setRecipient("");
    setAmount("");
    setExpiryDays("");
    setPurpose("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount || !recipient) return;

    const needsApproval = allowance !== undefined && allowance < parsedAmount;

    if (needsApproval) {
      setStep("approving");
      approve(parsedAmount);
      return;
    }

    doCreate();
  };

  // Called when allowance is already sufficient, or after approval
  const doCreate = () => {
    if (!parsedAmount || !recipient) return;

    const expiresAt =
      expiryDays && parseInt(expiryDays) > 0
        ? BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 24 * 60 * 60)
        : 0n;
    const purposeHash = purpose
      ? keccak256(toBytes(purpose))
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

    // Save predicted ID before creating
    predictedIdRef.current = nextId ?? 1n;
    setStep("creating");
    create(recipient as `0x${string}`, parsedAmount, expiresAt, purposeHash, autoRelease);
  };

  // After approval confirms, proceed to create
  useEffect(() => {
    if (step === "approved") {
      doCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Derived state ─────────────────────────────────────────────────

  const isValidRecipient = isAddress(recipient);
  const isValidAmount = parseFloat(amount) > 0;
  const hasSufficientBalance = balance !== undefined && parsedAmount !== undefined && balance >= parsedAmount;

  const showComplianceWarning =
    resolvedRecipient !== undefined &&
    parsedAmount !== undefined &&
    isCompliant === false &&
    !checkingCompliance;

  const isBusy = step !== "idle" && step !== "done";
  const needsApproval =
    allowance !== undefined && parsedAmount !== undefined && allowance < parsedAmount;

  const canSubmit =
    isValidRecipient &&
    isValidAmount &&
    hasSufficientBalance &&
    !isBusy &&
    !showComplianceWarning;

  const anyError = approveError || createError || contributeError;

  // ── Progress indicator ────────────────────────────────────────────

  const stepLabel = () => {
    if (step === "approving") {
      if (approvePending) return "Confirm approval in wallet...";
      if (approveConfirming) return "Approving USDT...";
    }
    if (step === "approved" || step === "creating") {
      if (createPending) return "Confirm transaction in wallet...";
      if (createConfirming) return "Creating remittance...";
    }
    if (step === "contributing") {
      if (contributePending) return "Confirm in wallet...";
      if (contributeConfirming) return "Sending funds...";
    }
    return null;
  };

  const stepProgress = () => {
    if (!needsApproval) {
      if (step === "creating") return 50;
      if (step === "contributing") return 75;
      if (step === "done") return 100;
      return 0;
    }
    if (step === "approving") return 25;
    if (step === "approved" || step === "creating") return 50;
    if (step === "contributing") return 75;
    if (step === "done") return 100;
    return 0;
  };

  // ── Done state ────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="space-y-5 text-center">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Money sent!</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            ${parseFloat(amount).toFixed(2)} USDT{" "}
            {autoRelease ? "will auto-release when the target is reached" : "is ready to be claimed"}.
          </p>
        </div>
        {contributeHash && (
          <a
            href={getExplorerTxUrl(chainId, contributeHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            View transaction
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        <button
          onClick={handleNewTransfer}
          className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Send Another
        </button>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Compliance status bar */}
      {complianceData && complianceData[0] && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Daily Sending Limit</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              ${formatUSDTDisplay(remainingLimit ?? (complianceData[2] - complianceData[1]))} remaining
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${complianceData[2] > 0n ? Math.max(2, 100 - Number((complianceData[1] * 100n) / complianceData[2])) : 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {complianceData && !complianceData[0] && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          Your account has been restricted. Please contact support.
        </div>
      )}

      {/* Recipient */}
      <div>
        <label htmlFor="recipient" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Recipient
        </label>
        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => { setRecipient(e.target.value); resetAll(); }}
          placeholder="Wallet address (0x...)"
          disabled={isBusy}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
        />
        {recipient && !isAddress(recipient) && (
          <p className="mt-1.5 text-xs text-red-500">Invalid Ethereum address</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Amount (USDT)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={isBusy}
            className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-8 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">USDT</span>
        </div>
        {balance !== undefined && parsedAmount !== undefined && balance < parsedAmount && (
          <p className="mt-1.5 text-xs text-red-500">
            Insufficient balance — you have ${formatUSDTDisplay(balance)} USDT
          </p>
        )}
      </div>

      {/* Expiry */}
      <div>
        <label htmlFor="expiry" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Expiry (days, optional)
        </label>
        <input
          id="expiry"
          type="number"
          min="0"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          placeholder="No expiry"
          disabled={isBusy}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
        />
      </div>

      {/* Purpose */}
      <div>
        <label htmlFor="purpose" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Purpose (optional)
        </label>
        <input
          id="purpose"
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g., School fees, Medical expenses..."
          disabled={isBusy}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
        />
      </div>

      {/* Auto-release toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Auto-release</p>
          <p className="text-xs text-zinc-500">Automatically release funds when target amount is met</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoRelease(!autoRelease)}
          disabled={isBusy}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${autoRelease ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRelease ? "left-5.5" : "left-0.5"}`} />
        </button>
      </div>

      {/* Fee breakdown */}
      {isValidAmount && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Platform Fee ({feePct}%)</span>
            <span className="text-zinc-900 dark:text-zinc-100">
              ${(parseFloat(amount) * feeDecimal).toFixed(2)} USDT
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Recipient receives</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              ${(parseFloat(amount) * (1 - feeDecimal)).toFixed(2)} USDT
            </span>
          </div>
        </div>
      )}

      {showComplianceWarning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
          This transfer exceeds your daily limit or the recipient is restricted.
        </div>
      )}

      {anyError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {decodeContractError(anyError)}
          <button onClick={resetAll} className="ml-2 underline">Try again</button>
        </div>
      )}

      {/* Progress steps — shown while busy */}
      {isBusy && (
        <div className="space-y-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${stepProgress()}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <svg className="h-4 w-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {stepLabel()}
          </div>
          {needsApproval && (
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${step === "approving" ? "bg-emerald-600 text-white" : approveSuccess ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"}`}>
                {approveSuccess ? "✓" : "1"}
              </span>
              <span className={approveSuccess ? "text-emerald-600 dark:text-emerald-400" : ""}>Approve USDT</span>
              <span className="text-zinc-300 dark:text-zinc-600">→</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${step === "creating" ? "bg-emerald-600 text-white" : createSuccess ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"}`}>
                {createSuccess ? "✓" : "2"}
              </span>
              <span className={createSuccess ? "text-emerald-600 dark:text-emerald-400" : ""}>Create</span>
              <span className="text-zinc-300 dark:text-zinc-600">→</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${step === "contributing" ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"}`}>
                3
              </span>
              <span>Send Funds</span>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!isBusy && (
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-emerald-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {needsApproval && isValidAmount ? "Approve & Send" : "Send Money"}
        </button>
      )}
    </form>
  );
}
