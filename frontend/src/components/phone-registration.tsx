"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useHasPhone, useRegisterPhoneString } from "@/hooks/use-phone-resolver";
import { decodeContractError } from "@/lib/utils";

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

export function PhoneRegistration() {
  const { address, isConnected } = useAccount();
  const [phoneInput, setPhoneInput] = useState("");

  const { data: hasPhone, isLoading: checkingPhone } = useHasPhone(address);
  const { register, isPending, isConfirming, isSuccess, error, reset } =
    useRegisterPhoneString();

  const isValid = isValidE164(phoneInput);

  const handleRegister = () => {
    if (!isValid || !address) return;
    register(phoneInput, address);
  };

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Connect your wallet to register your phone number.
      </div>
    );
  }

  if (checkingPhone) {
    return <div className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  }

  if (hasPhone || isSuccess) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-900/20">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
            <svg
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              Phone number registered
            </p>
            <p className="mt-0.5 text-sm text-emerald-600 dark:text-emerald-500">
              Anyone can now send you money using just your phone number — no
              crypto address needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
          Register your phone number
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Link your phone to your wallet so senders can find you using just your
          number — no crypto address needed.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => {
              setPhoneInput(e.target.value);
              reset();
            }}
            placeholder="+254712345678"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-emerald-500"
          />
          {phoneInput && !isValid && (
            <p className="mt-1.5 text-xs text-red-500">
              Use international format: +[country code][number], e.g.
              +254712345678
            </p>
          )}
          {phoneInput && isValid && (
            <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-500">
              Format looks good
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            {decodeContractError(error)}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={!isValid || isPending || isConfirming}
          className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Confirm in wallet..."
            : isConfirming
              ? "Registering..."
              : "Register Phone Number"}
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
        Your phone number is hashed on-chain for privacy — it cannot be read
        back from the contract.
      </p>
    </div>
  );
}
