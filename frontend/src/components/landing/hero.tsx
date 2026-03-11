"use client";

import { ConnectKitButton } from "connectkit";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/5" />
        <div className="absolute -top-20 right-0 h-[400px] w-[400px] rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-400/5" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:pb-32 sm:pt-36">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Built on Uniswap v4 &middot; Live on Base &amp; Unichain
          </div>

          {/* Main heading */}
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl dark:text-zinc-50">
            Cross-border payments,{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
              reimagined
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
            Send money to anyone, anywhere, with fees under 1%. Powered by
            Uniswap v4 hooks for instant settlement, on-chain compliance, and
            group contributions&mdash;on Base &amp; Unichain.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <ConnectKitButton />
            <a
              href="#how-it-works"
              className="group flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              See how it works
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:translate-y-0.5"
              >
                <path
                  d="M8 3v10M4 9l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-20 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              { value: "< 1%", label: "Total fees" },
              { value: "~200ms", label: "Settlement" },
              { value: "0.5%", label: "Platform fee" },
              { value: "24/7", label: "Availability" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
