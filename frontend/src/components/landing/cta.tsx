"use client";

import Link from "next/link";

export function CTA() {
  return (
    <section className="border-t border-zinc-100 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-14 text-center sm:px-16 sm:py-16 dark:from-emerald-700 dark:to-teal-700">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white" />
          </div>

          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white sm:text-4xl">
              Ready to send your first remittance?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-emerald-100 sm:text-lg">
              Connect your wallet, create a remittance, and experience
              cross-border payments that are fast, cheap, and transparent.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/send"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-emerald-700 shadow-md transition-all hover:bg-emerald-50 hover:shadow-lg"
              >
                Get Started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <p className="mt-6 text-xs text-emerald-200 sm:text-sm">
              Currently live on Base Sepolia testnet. Mainnet launch coming soon.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
