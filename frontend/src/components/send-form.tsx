"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress, keccak256, toBytes } from "viem";
import { useCreateRemittance } from "@/hooks/use-contract-write";
import { useComplianceStatus } from "@/hooks/use-compliance";
import { parseUSDT, formatUSDTDisplay } from "@/lib/utils";

export function SendForm() {
  const { address } = useAccount();
  const [recipientType, setRecipientType] = useState<"address" | "phone">(
    "address"
  );
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [purpose, setPurpose] = useState("");
  const [autoRelease, setAutoRelease] = useState(true);

  const { create, isPending, isConfirming, isSuccess, error, reset } =
    useCreateRemittance();
  const { data: complianceData } = useComplianceStatus(address);

  useEffect(() => {
    if (isSuccess) {
      setRecipient("");
      setAmount("");
      setExpiryDays("");
      setPurpose("");
    }
  }, [isSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipient || !amount) return;

    const targetAmount = parseUSDT(amount);
    const expiresAt =
      expiryDays && parseInt(expiryDays) > 0
        ? BigInt(
            Math.floor(Date.now() / 1000) +
              parseInt(expiryDays) * 24 * 60 * 60
          )
        : 0n;
    const purposeHash = purpose
      ? keccak256(toBytes(purpose))
      : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`);

    if (recipientType === "address" && isAddress(recipient)) {
      create(
        recipient as `0x${string}`,
        targetAmount,
        expiresAt,
        purposeHash,
        autoRelease
      );
    }
  };

  const isValidRecipient =
    recipientType === "address" ? isAddress(recipient) : recipient.length > 0;
  const isValidAmount = parseFloat(amount) > 0;
  const canSubmit =
    isValidRecipient && isValidAmount && !isPending && !isConfirming;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Compliance status */}
      {complianceData && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Compliance Status
            </span>
            <span
              className={
                complianceData[0]
                  ? "font-medium text-emerald-600"
                  : "font-medium text-red-600"
              }
            >
              {complianceData[0] ? "Verified" : "Not Verified"}
            </span>
          </div>
          {complianceData[0] && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Daily Limit Remaining
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                ${formatUSDTDisplay(complianceData[2] - complianceData[1])}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Recipient type toggle */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Send to
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRecipientType("address");
              setRecipient("");
            }}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              recipientType === "address"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Wallet Address
          </button>
          <button
            type="button"
            onClick={() => {
              setRecipientType("phone");
              setRecipient("");
            }}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              recipientType === "phone"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Phone Number
          </button>
        </div>
      </div>

      {/* Recipient input */}
      <div>
        <label
          htmlFor="recipient"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {recipientType === "address" ? "Recipient Address" : "Phone Number"}
        </label>
        <input
          id="recipient"
          type="text"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            reset();
          }}
          placeholder={
            recipientType === "address" ? "0x..." : "+254712345678"
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
        />
        {recipientType === "address" && recipient && !isAddress(recipient) && (
          <p className="mt-1.5 text-xs text-red-500">
            Invalid Ethereum address
          </p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label
          htmlFor="amount"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Amount (USDT)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            $
          </span>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-8 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
            USDT
          </span>
        </div>
      </div>

      {/* Expiry */}
      <div>
        <label
          htmlFor="expiry"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Expiry (days, optional)
        </label>
        <input
          id="expiry"
          type="number"
          min="0"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          placeholder="No expiry"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
        />
      </div>

      {/* Purpose */}
      <div>
        <label
          htmlFor="purpose"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Purpose (optional)
        </label>
        <input
          id="purpose"
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g., School fees, Medical expenses..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
        />
      </div>

      {/* Auto-release toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Auto-release
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Automatically release funds when target amount is met
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAutoRelease(!autoRelease)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            autoRelease
              ? "bg-emerald-500"
              : "bg-zinc-300 dark:bg-zinc-600"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              autoRelease ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {/* Fee info */}
      {isValidAmount && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Platform Fee (0.5%)
            </span>
            <span className="text-zinc-900 dark:text-zinc-100">
              ${(parseFloat(amount) * 0.005).toFixed(2)} USDT
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Recipient receives
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              ${(parseFloat(amount) * 0.995).toFixed(2)} USDT
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error.message.includes("User rejected")
            ? "Transaction was rejected"
            : error.message.slice(0, 200)}
        </div>
      )}

      {/* Success message */}
      {isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
          Remittance created successfully! Check your dashboard for details.
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-emerald-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
      >
        {isPending
          ? "Confirm in Wallet..."
          : isConfirming
            ? "Creating Remittance..."
            : "Create Remittance"}
      </button>
    </form>
  );
}
