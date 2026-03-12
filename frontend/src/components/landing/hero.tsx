"use client";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/5" />
        <div className="absolute -top-20 right-0 h-[400px] w-[400px] rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-400/5" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pb-28 sm:pt-32">
        <div className="flex flex-col items-center text-center">
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl dark:text-zinc-50">
            Cross-border payments,{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
              reimagined
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
            Send money to anyone, anywhere, with fees under 1%. Powered by
            Uniswap v4 hooks for instant settlement, on-chain compliance, and
            group contributions&mdash;on Base &amp; Unichain.
          </p>

          <div className="mt-10">
            <a
              href="#how-it-works"
              className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
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

          <div className="mt-16 grid grid-cols-2 gap-6 sm:mt-20 sm:grid-cols-4 sm:gap-10">
            {[
              { value: "< 1%", label: "Total fees" },
              { value: "~200ms", label: "Settlement" },
              { value: "0.5%", label: "Platform fee" },
              { value: "24/7", label: "Availability" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-zinc-500 sm:text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
