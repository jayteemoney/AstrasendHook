"use client";

const stack = [
  {
    name: "Uniswap v4",
    role: "Hook Architecture",
    description: "beforeSwap compliance checks and afterSwap contribution recording via custom hooks.",
  },
  {
    name: "Base L2",
    role: "Settlement Layer",
    description: "Sub-cent gas fees with Ethereum-grade security. ~2s finality on Coinbase's flagship L2.",
  },
  {
    name: "Unichain",
    role: "MEV-Protected Settlement",
    description: "200ms Flashblocks for near-instant settlement. TEE-secured block building ensures senders get the price they expect.",
  },
  {
    name: "USDT",
    role: "Stable Corridor",
    description: "Stablecoin-denominated transfers eliminate FX risk during transit.",
  },
  {
    name: "World ID",
    role: "Identity (Phase 2)",
    description: "Biometric proof-of-personhood via zero-knowledge proofs. Sybil-resistant.",
  },
];

export function TechStack() {
  return (
    <section id="technology" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Technology
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Built on battle-tested infrastructure
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {stack.map((item) => (
            <div
              key={item.name}
              className="flex gap-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {item.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {item.role}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Architecture diagram (text-based) */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Architecture Flow
          </h3>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-0">
            {[
              { label: "Sender", sub: "Wallet" },
              { label: "Uniswap v4", sub: "Pool + Hook" },
              { label: "AstraSendHook", sub: "Escrow" },
              { label: "Compliance", sub: "KYC / World ID" },
              { label: "Recipient", sub: "Wallet" },
            ].map((node, i, arr) => (
              <div key={node.label} className="flex items-center gap-0">
                <div className="flex flex-col items-center rounded-lg border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {node.label}
                  </span>
                  <span className="text-xs text-zinc-400">{node.sub}</span>
                </div>
                {i < arr.length - 1 && (
                  <svg
                    width="32"
                    height="16"
                    viewBox="0 0 32 16"
                    fill="none"
                    className="mx-1 hidden shrink-0 text-emerald-400 sm:block"
                  >
                    <path
                      d="M0 8h28M24 3l4 5-4 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
