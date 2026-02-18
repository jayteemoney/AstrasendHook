"use client";

import { ConnectKitButton } from "connectkit";

export function CTA() {
  return (
    <section className="border-t border-zinc-100 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 px-8 py-16 text-center sm:px-16 dark:from-emerald-700 dark:to-teal-700">
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white" />
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to send your first remittance?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-emerald-100">
              Connect your wallet, create a remittance, and experience
              cross-border payments that are fast, cheap, and transparent.
            </p>
            <div className="mt-8 flex justify-center">
              <ConnectKitButton />
            </div>
            <p className="mt-6 text-sm text-emerald-200">
              Currently live on Base Sepolia testnet. Mainnet launch coming soon.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
