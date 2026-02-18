"use client";

const steps = [
  {
    step: "01",
    title: "Create a Remittance",
    description:
      "Set a target amount, recipient wallet or phone number, and optional expiry. The smart contract creates a secure escrow on Base.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Fund Individually or as a Group",
    description:
      "Contribute USDT directly or through Uniswap v4 swaps. Multiple people can pool funds toward a single remittance for collective support.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Auto-Release on Target",
    description:
      "When the target amount is reached, funds are automatically released to the recipient—minus a tiny 0.5% fee. No middleman needed.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4 12 14.01l-3-3" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Recipient Claims Funds",
    description:
      "The recipient can also manually release once the target is met, or claim refunds if the remittance expires. Full control, full transparency.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <path d="M1 10h22" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-zinc-100 bg-white py-24 dark:border-zinc-800/50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Four steps to instant remittance
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
            From creating a remittance to the recipient claiming funds—simple,
            transparent, and on-chain.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, i) => (
            <div
              key={item.step}
              className="group relative rounded-2xl border border-zinc-200 bg-zinc-50 p-6 transition-all hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10"
            >
              {/* Step number */}
              <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                Step {item.step}
              </span>

              {/* Icon */}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:bg-emerald-900/50">
                {item.icon}
              </div>

              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {item.description}
              </p>

              {/* Connector line on desktop */}
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-1/2 z-10 hidden h-px w-6 bg-zinc-300 dark:bg-zinc-700 lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
