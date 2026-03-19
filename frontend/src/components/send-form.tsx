"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { isAddress, keccak256, toBytes, maxUint256 } from "viem";
import {
  useCreateRemittance,
  useCreateRemittanceByPhone,
  useContributeDirectly,
  useApproveUSDT,
  useUSDTAllowance,
  useUSDTBalance,
  useMintTestUSDT,
} from "@/hooks/use-contract-write";
import { useResolvePhoneString } from "@/hooks/use-phone-resolver";
import { getContracts } from "@/config/contracts";
import { useComplianceStatus, useIsCompliant, useRemainingDailyLimit } from "@/hooks/use-compliance";
import { usePlatformFee, useNextRemittanceId } from "@/hooks/use-remittance";
import { parseUSDT, formatUSDTDisplay, decodeContractError, getExplorerTxUrl } from "@/lib/utils";
import { trackContributedRemittance } from "@/hooks/use-user-remittances";

type Step = "idle" | "approving" | "approved" | "creating" | "contributing" | "done";
type RecipientMode = "address" | "phone";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// keccak256("RemittanceCreated(uint256,address,address,uint256,uint256,bool)")
const REMITTANCE_CREATED_TOPIC = "0x3f10847f6f650b8341339b23422f4bc63035a6d8d75ea6b055514ff6a8b3da8f" as `0x${string}`;

export function SendForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const contracts = getContracts(chainId);
  const SUPPORTED_CHAIN_IDS = [84532, 1301];
  const isWrongNetwork = !SUPPORTED_CHAIN_IDS.includes(chainId);

  const [recipient, setRecipient] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("address");
  const [amount, setAmount] = useState("");
  const [groupFunding, setGroupFunding] = useState(false);
  const [targetAmount, setTargetAmount] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [purpose, setPurpose] = useState("");
  const [autoRelease, setAutoRelease] = useState(true);
  const [step, setStep] = useState<Step>("idle");

  const predictedIdRef = useRef<bigint | null>(null);
  const [createdRemittanceId, setCreatedRemittanceId] = useState<bigint | null>(null);

  const isPhoneMode = recipientMode === "phone";

  // Platform fee
  const { data: platformFeeBps } = usePlatformFee();
  const feePct = platformFeeBps !== undefined ? Number(platformFeeBps) / 100 : 0.5;
  const feeDecimal = feePct / 100;

  // Compliance
  const { data: complianceData } = useComplianceStatus(address);
  const { data: remainingLimit } = useRemainingDailyLimit(address);

  // USDT balance & allowance
  const { data: balance, refetch: refetchBalance } = useUSDTBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDTAllowance(address);
  const {
    mint,
    isPending: mintPending,
    isConfirming: mintConfirming,
    isSuccess: mintSuccess,
    reset: resetMint,
  } = useMintTestUSDT();

  // Next remittance ID
  const { data: nextId } = useNextRemittanceId();

  // Phone resolution (only active in phone mode)
  const { data: resolvedPhoneWallet, isLoading: phoneResolving } = useResolvePhoneString(
    isPhoneMode && recipient.length > 3 ? recipient : undefined
  );

  // Phone hash computed client-side (matches contract: keccak256(abi.encodePacked(phone)))
  const phoneHash = useMemo(() => {
    if (!isPhoneMode || !recipient) return undefined;
    try {
      return keccak256(toBytes(recipient)) as `0x${string}`;
    } catch {
      return undefined;
    }
  }, [isPhoneMode, recipient]);

  // Resolved recipient for compliance check and validation
  const resolvedRecipient = useMemo(() => {
    if (!isPhoneMode) {
      return isAddress(recipient) ? (recipient as `0x${string}`) : undefined;
    }
    if (resolvedPhoneWallet && resolvedPhoneWallet !== ZERO_ADDRESS) {
      return resolvedPhoneWallet as `0x${string}`;
    }
    return undefined;
  }, [recipient, isPhoneMode, resolvedPhoneWallet]);

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amount);
    return val > 0 ? parseUSDT(amount) : undefined;
  }, [amount]);

  // When group funding is off, target = contribution. When on, target is the group goal.
  const parsedTargetAmount = useMemo(() => {
    if (!groupFunding) return parsedAmount;
    const val = parseFloat(targetAmount);
    return val > 0 ? parseUSDT(targetAmount) : undefined;
  }, [groupFunding, targetAmount, parsedAmount]);

  const { data: isCompliant, isLoading: checkingCompliance } = useIsCompliant(
    address,
    resolvedRecipient,
    parsedAmount
  );

  // ── Contract write hooks ──────────────────────────────────────────

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
    receipt: createReceipt,
    isPending: createPending,
    isConfirming: createConfirming,
    isSuccess: createSuccess,
    error: createError,
    reset: resetCreate,
  } = useCreateRemittance();

  const {
    createByPhone,
    receipt: createByPhoneReceipt,
    isPending: createByPhonePending,
    isConfirming: createByPhoneConfirming,
    isSuccess: createByPhoneSuccess,
    error: createByPhoneError,
    reset: resetCreateByPhone,
  } = useCreateRemittanceByPhone();

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

  useEffect(() => {
    if (approveSuccess && step === "approving") {
      refetchAllowance();
      setStep("approved");
    }
  }, [approveSuccess, step, refetchAllowance]);

  useEffect(() => {
    const succeeded = isPhoneMode ? createByPhoneSuccess : createSuccess;
    const receipt = isPhoneMode ? createByPhoneReceipt : createReceipt;
    if (succeeded && step === "creating" && receipt) {
      // Parse remittance ID directly from topics[1] of the RemittanceCreated log.
      // Filter to logs from the hook contract to avoid false matches.
      let remittanceId = predictedIdRef.current ?? 1n;
      const hookAddress = contracts.astraSendHook.toLowerCase();
      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === hookAddress &&
          log.topics[0] === REMITTANCE_CREATED_TOPIC &&
          log.topics[1]
        ) {
          remittanceId = BigInt(log.topics[1]);
          break;
        }
      }
      setCreatedRemittanceId(remittanceId);
      setStep("contributing");
      // waitForNode=true: poll until the RPC node sees the new remittance before
      // simulating/writing, avoiding gas estimation failures from propagation lag.
      contribute(remittanceId, parsedAmount!, true);
    }
  }, [
    createSuccess,
    createByPhoneSuccess,
    step,
    createReceipt,
    createByPhoneReceipt,
    isPhoneMode,
    contribute,
    parsedAmount,
    contracts.astraSendHook,
  ]);

  useEffect(() => {
    if (contributeSuccess && step === "contributing") {
      if (address && createdRemittanceId !== null) {
        trackContributedRemittance(chainId, address, createdRemittanceId);
      }
      setStep("done");
    }
  }, [contributeSuccess, step, address, chainId, createdRemittanceId]);

  useEffect(() => {
    if (mintSuccess) {
      refetchBalance();
      resetMint();
    }
  }, [mintSuccess, refetchBalance, resetMint]);

  // Auto-reset form 4 seconds after successful send (only for non-group-funding)
  useEffect(() => {
    if (step === "done" && !groupFunding) {
      const timer = setTimeout(() => {
        handleNewTransfer();
      }, 4000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, groupFunding]);

  // ── Handlers ─────────────────────────────────────────────────────

  const resetAll = () => {
    resetApprove();
    resetCreate();
    resetCreateByPhone();
    resetContribute();
    setStep("idle");
    predictedIdRef.current = null;
    setCreatedRemittanceId(null);
  };

  const handleNewTransfer = () => {
    resetAll();
    setRecipient("");
    setAmount("");
    setTargetAmount("");
    setGroupFunding(false);
    setExpiryDays("");
    setPurpose("");
  };

  const handleRecipientChange = (val: string) => {
    if (val.startsWith("+")) setRecipientMode("phone");
    else if (val.startsWith("0x") || val === "") setRecipientMode("address");
    setRecipient(val);
    resetAll();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAmount) return;
    if (isPhoneMode && !phoneHash) return;
    if (!isPhoneMode && !recipient) return;

    const needsApproval = allowance === undefined || allowance < parsedAmount;
    if (needsApproval) {
      setStep("approving");
      approve(maxUint256);
      return;
    }
    doCreate();
  };

  const doCreate = () => {
    if (!parsedAmount || !parsedTargetAmount) return;

    const expiresAt =
      expiryDays && parseInt(expiryDays) > 0
        ? BigInt(Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 24 * 60 * 60)
        : 0n;
    const purposeHash = purpose
      ? keccak256(toBytes(purpose))
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

    predictedIdRef.current = nextId ?? 1n;
    setStep("creating");

    if (isPhoneMode) {
      if (!phoneHash) return;
      createByPhone(phoneHash, parsedTargetAmount, expiresAt, purposeHash, autoRelease);
    } else {
      if (!recipient) return;
      create(recipient as `0x${string}`, parsedTargetAmount, expiresAt, purposeHash, autoRelease);
    }
  };

  useEffect(() => {
    if (step === "approved") {
      doCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Derived state ─────────────────────────────────────────────────

  const isPhoneFormatValid = isPhoneMode && E164_REGEX.test(recipient);
  const isPhoneRegistered =
    isPhoneMode &&
    isPhoneFormatValid &&
    !phoneResolving &&
    resolvedPhoneWallet !== undefined &&
    resolvedPhoneWallet !== ZERO_ADDRESS;

  const isValidRecipient = isPhoneMode
    ? isPhoneRegistered
    : isAddress(recipient);

  const isValidAmount = parseFloat(amount) > 0;
  const hasSufficientBalance =
    balance !== undefined && parsedAmount !== undefined && balance >= parsedAmount;

  const showComplianceWarning =
    resolvedRecipient !== undefined &&
    parsedAmount !== undefined &&
    isCompliant === false &&
    !checkingCompliance;

  const isBusy = step !== "idle" && step !== "done";
  const needsApproval =
    allowance !== undefined && parsedAmount !== undefined && allowance < parsedAmount;

  const isLoadingData = balance === undefined || nextId === undefined;

  const isValidTarget =
    !groupFunding ||
    (parsedTargetAmount !== undefined &&
      parsedAmount !== undefined &&
      parsedTargetAmount >= parsedAmount);

  const canSubmit =
    isValidRecipient &&
    isValidAmount &&
    isValidTarget &&
    hasSufficientBalance &&
    !isBusy &&
    !showComplianceWarning &&
    !isLoadingData;

  const anyError = approveError || createError || createByPhoneError || contributeError;
  const activeCreateSuccess = isPhoneMode ? createByPhoneSuccess : createSuccess;

  // ── Progress ──────────────────────────────────────────────────────

  const stepLabel = () => {
    if (step === "approving") {
      if (approvePending) return "Confirm approval in wallet...";
      if (approveConfirming) return "Approving USDT...";
    }
    if (step === "approved" || step === "creating") {
      const pending = isPhoneMode ? createByPhonePending : createPending;
      const confirming = isPhoneMode ? createByPhoneConfirming : createConfirming;
      if (pending) return "Confirm transaction in wallet...";
      if (confirming) return "Creating remittance...";
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
    const isGroupFundingCreation =
      groupFunding && parsedTargetAmount && parsedAmount && parsedTargetAmount > parsedAmount;
    const detailsPath = createdRemittanceId !== null
      ? `/remittance/${createdRemittanceId.toString()}`
      : null;

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
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isGroupFundingCreation ? "Group remittance created!" : "Money sent!"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {isGroupFundingCreation
              ? `$${parseFloat(amount).toFixed(2)} contributed toward a $${parseFloat(targetAmount).toFixed(2)} group goal.`
              : `$${parseFloat(amount).toFixed(2)} USDT ${autoRelease ? "will auto-release when the target is reached" : "is ready to be claimed"}.`}
          </p>
        </div>

        {/* View details + share link (group funding) */}
        {detailsPath && (
          <div className="space-y-2">
            <a
              href={detailsPath}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              View Remittance Details
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            {isGroupFundingCreation && (
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}${detailsPath}`;
                  navigator.clipboard.writeText(url);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Share Link
              </button>
            )}
          </div>
        )}

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
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Send Another
        </button>
        {!isGroupFundingCreation && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Form resets automatically in a few seconds
          </p>
        )}
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────

  if (isWrongNetwork) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
        <p className="font-medium mb-2">Wrong network</p>
        <p className="mb-4">Your wallet is on an unsupported network. Please switch to Base Sepolia or Unichain Sepolia.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchChain({ chainId: 84532 })}
            className="rounded-md bg-amber-100 px-3 py-1.5 font-medium hover:bg-amber-200 dark:bg-amber-800/40 dark:hover:bg-amber-800/60"
          >
            Switch to Base Sepolia
          </button>
          <button
            type="button"
            onClick={() => switchChain({ chainId: 1301 })}
            className="rounded-md bg-amber-100 px-3 py-1.5 font-medium hover:bg-amber-200 dark:bg-amber-800/40 dark:hover:bg-amber-800/60"
          >
            Switch to Unichain Sepolia
          </button>
        </div>
      </div>
    );
  }

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
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Recipient
          </label>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => { setRecipientMode("address"); setRecipient(""); resetAll(); }}
              disabled={isBusy}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                !isPhoneMode
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={() => { setRecipientMode("phone"); setRecipient(""); resetAll(); }}
              disabled={isBusy}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                isPhoneMode
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Phone
            </button>
          </div>
        </div>

        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => handleRecipientChange(e.target.value)}
          placeholder={isPhoneMode ? "+2348012345678" : "0x..."}
          disabled={isBusy}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
        />

        {/* Address mode: invalid format */}
        {!isPhoneMode && recipient && !isAddress(recipient) && (
          <p className="mt-1.5 text-xs text-red-500">Invalid Ethereum address</p>
        )}

        {/* Phone mode: format hint */}
        {isPhoneMode && !recipient && (
          <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
            E.164 format — include country code, e.g. +2348012345678
          </p>
        )}

        {/* Phone mode: invalid format */}
        {isPhoneMode && recipient && !isPhoneFormatValid && (
          <p className="mt-1.5 text-xs text-red-500">
            Enter a valid phone number with country code (e.g. +2348012345678)
          </p>
        )}

        {/* Phone mode: resolving */}
        {isPhoneMode && isPhoneFormatValid && phoneResolving && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Resolving phone number...
          </div>
        )}

        {/* Phone mode: not registered */}
        {isPhoneMode && isPhoneFormatValid && !phoneResolving &&
          resolvedPhoneWallet === ZERO_ADDRESS && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
            This phone number is not registered on AstraSend. Ask the recipient to register at{" "}
            <span className="font-medium">/receive</span>.
          </div>
        )}

        {/* Phone mode: resolved successfully */}
        {isPhoneMode && isPhoneRegistered && resolvedRecipient && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-900/20">
            <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Sends to:{" "}
              <span className="font-mono font-medium">
                {resolvedRecipient.slice(0, 6)}...{resolvedRecipient.slice(-4)}
              </span>
            </span>
          </div>
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
        <button
          type="button"
          onClick={() => mint(1_000n * 1_000_000n)}
          disabled={mintPending || mintConfirming}
          className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400"
        >
          {mintPending ? "Confirm in wallet..." : mintConfirming ? "Minting..." : "Get 1,000 Test USDT"}
        </button>
      </div>

      {/* Group Funding */}
      <div>
        <button
          type="button"
          onClick={() => { setGroupFunding(!groupFunding); setTargetAmount(""); }}
          disabled={isBusy}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Group Funding</p>
            <p className="text-xs text-zinc-500">Set a higher target so others can contribute the rest</p>
          </div>
          <div className={`relative h-6 w-11 rounded-full transition-colors ${groupFunding ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${groupFunding ? "left-5.5" : "left-0.5"}`} />
          </div>
        </button>

        {groupFunding && (
          <div className="mt-3">
            <label htmlFor="target-amount" className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Group Target (USDT)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input
                id="target-amount"
                type="number"
                min="0"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="e.g. 500.00"
                disabled={isBusy}
                className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-8 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">USDT</span>
            </div>
            {parsedTargetAmount !== undefined && parsedAmount !== undefined && parsedTargetAmount < parsedAmount && (
              <p className="mt-1.5 text-xs text-red-500">Target must be at least your contribution (${parseFloat(amount).toFixed(2)})</p>
            )}
            {parsedTargetAmount !== undefined && parsedAmount !== undefined && parsedTargetAmount >= parsedAmount && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-500">
                Others can contribute the remaining ${(parseFloat(targetAmount) - parseFloat(amount)).toFixed(2)} USDT
              </p>
            )}
          </div>
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
          {groupFunding && parsedTargetAmount !== undefined && parsedAmount !== undefined && parsedTargetAmount >= parsedAmount && (
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Your contribution</span>
              <span className="text-zinc-900 dark:text-zinc-100">${parseFloat(amount).toFixed(2)} USDT</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Platform Fee ({feePct}%)</span>
            <span className="text-zinc-900 dark:text-zinc-100">
              ${((groupFunding && parsedTargetAmount ? parseFloat(targetAmount) : parseFloat(amount)) * feeDecimal).toFixed(2)} USDT
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Recipient receives</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              ${((groupFunding && parsedTargetAmount ? parseFloat(targetAmount) : parseFloat(amount)) * (1 - feeDecimal)).toFixed(2)} USDT
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

      {/* Progress steps */}
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
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${step === "creating" ? "bg-emerald-600 text-white" : activeCreateSuccess ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"}`}>
                {activeCreateSuccess ? "✓" : "2"}
              </span>
              <span className={activeCreateSuccess ? "text-emerald-600 dark:text-emerald-400" : ""}>Create</span>
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
          {isLoadingData && isValidAmount
            ? "Loading..."
            : needsApproval && isValidAmount
            ? "Approve & Send"
            : "Send Money"}
        </button>
      )}
    </form>
  );
}
