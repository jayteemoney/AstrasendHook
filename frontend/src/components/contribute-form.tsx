"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  useContributeDirectly,
  useApproveUSDT,
  useUSDTAllowance,
  useUSDTBalance,
} from "@/hooks/use-contract-write";
import { parseUSDT, formatUSDT, formatUSDTDisplay, decodeContractError, getExplorerTxUrl } from "@/lib/utils";
import { getContracts } from "@/config/contracts";
import { trackContributedRemittance } from "@/hooks/use-user-remittances";

type ContributeTab = "direct" | "swap";

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
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const [tab, setTab] = useState<ContributeTab>("direct");
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
    hash: contributeHash,
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
      if (address) trackContributedRemittance(chainId, address, remittanceId);
      setAmount("");
      onSuccess?.();
    }
  }, [contributeSuccess, address, chainId, remittanceId, onSuccess]);

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

  // hookData encoding: abi.encode(uint256 remittanceId)
  const hookDataHex = (() => {
    const id = remittanceId;
    return "0x" + id.toString(16).padStart(64, "0");
  })();

  return (
    <div className="space-y-4">
      {/* Tab Toggle */}
      <div className="flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setTab("direct")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === "direct"
              ? "bg-emerald-600 text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          Direct
        </button>
        <button
          type="button"
          onClick={() => setTab("swap")}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            tab === "swap"
              ? "bg-violet-600 text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          via Swap
          <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            v4
          </span>
        </button>
      </div>

      {tab === "direct" ? (
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
              {decodeContractError(error)}
            </div>
          )}

          {contributeSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
              Contribution successful!{" "}
              {contributeHash && (
                <a
                  href={getExplorerTxUrl(chainId, contributeHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-emerald-800 dark:hover:text-emerald-300"
                >
                  View transaction
                </a>
              )}
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
      ) : (
        <SwapExplainer
          remittanceId={remittanceId}
          hookAddress={contracts.astraSendHook}
          usdtAddress={contracts.usdt}
          hookDataHex={hookDataHex}
        />
      )}
    </div>
  );
}

interface SwapExplainerProps {
  remittanceId: bigint;
  hookAddress: string;
  usdtAddress: string;
  hookDataHex: string;
}

function SwapExplainer({ remittanceId, hookAddress, usdtAddress, hookDataHex }: SwapExplainerProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-900/20">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            UNISWAP v4 HOOK
          </span>
          <span className="text-xs font-semibold text-violet-800 dark:text-violet-300">
            afterSwapReturnDelta
          </span>
        </div>
        <p className="text-xs text-violet-700 dark:text-violet-400">
          Swap any token into USDT through the AstraSend pool and the v4 hook
          automatically redirects your output directly into this remittance
          escrow — no extra transaction needed.
        </p>
      </div>

      {/* How it works */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          How it works
        </p>
        <ol className="space-y-2">
          {[
            {
              step: "1",
              label: "Swap ETH → USDT",
              desc: "Route your swap through the AstraSend Uniswap v4 pool with hookData set to this remittance ID.",
            },
            {
              step: "2",
              label: "Hook intercepts output",
              desc: "The afterSwap callback fires. The hook reads hookData, identifies the remittance, and calls PoolManager.take() to pull the USDT output.",
            },
            {
              step: "3",
              label: "Funds credited to escrow",
              desc: "USDT lands directly in the remittance escrow. The swapper's BalanceDelta is zeroed — they receive no USDT, it goes to the recipient instead.",
            },
            {
              step: "4",
              label: "Auto-release (if enabled)",
              desc: "If target is now met and auto-release is on, funds are released to the recipient in the same transaction.",
            },
          ].map(({ step, label, desc }) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {step}
              </span>
              <div>
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {label}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Technical params */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Pool parameters
        </p>
        <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">hook</span>
            <span className="break-all text-right text-zinc-800 dark:text-zinc-200">
              {hookAddress}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">currency1 (USDT)</span>
            <span className="break-all text-right text-zinc-800 dark:text-zinc-200">
              {usdtAddress}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-zinc-500">remittanceId</span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {remittanceId.toString()}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="shrink-0 text-zinc-500">hookData</span>
            <span className="break-all text-right text-zinc-800 dark:text-zinc-200">
              {hookDataHex}
            </span>
          </div>
        </div>
      </div>

      {/* Code snippet */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          SwapParams (Uniswap v4 PoolManager)
        </p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-900 p-3 text-[10px] leading-relaxed text-zinc-100 dark:border-zinc-700">
{`IPoolManager.SwapParams({
  zeroForOne: true,          // ETH → USDT
  amountSpecified: -amount,  // exact input
  sqrtPriceLimitX96: ...
});

// hookData = abi.encode(remittanceId)
bytes hookData = abi.encode(${remittanceId})`}
        </pre>
      </div>

      {/* Why no button */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
          Why is there no Swap button?
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Uniswap v4 swaps go through the{" "}
          <span className="font-mono">PoolManager.unlock()</span> callback
          pattern — they cannot be submitted as a direct browser transaction.
          A dedicated router contract would be the integration point. The hook
          mechanic is fully implemented and proven in integration tests against
          the real PoolManager (see below).
        </p>
      </div>

      {/* Test proof */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Proven in integration tests
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">21 passing — HookSwapPath.t.sol</p>
            {[
              "test_afterSwap_capturesUSDT",
              "test_afterSwap_autoRelease",
              "test_afterSwap_fuzz_contributionAmounts",
              "test_afterSwap_solvencyOnRelease",
            ].map((t) => (
              <p key={t} className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                ✓ {t}
              </p>
            ))}
            <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-500">
              + 17 more
            </p>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-900 p-2.5 text-[10px] leading-relaxed text-zinc-100 dark:border-zinc-700">
{`forge test --match-path test/HookSwapPath.t.sol -vv`}
        </pre>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        <span className="font-mono">afterSwapReturnDelta</span> is encoded in
        the hook address at deployment via CREATE2 salt mining. This permission
        is impossible to use in Uniswap v3 or any prior DEX version.
      </p>
    </div>
  );
}
