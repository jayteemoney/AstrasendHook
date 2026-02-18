"use client";

const rows = [
  {
    feature: "Total Fee",
    traditional: "6 – 15%",
    remitswap: "< 1%",
    highlight: true,
  },
  {
    feature: "Settlement Time",
    traditional: "1 – 5 business days",
    remitswap: "~2 seconds",
    highlight: true,
  },
  {
    feature: "Availability",
    traditional: "Business hours only",
    remitswap: "24/7/365",
    highlight: false,
  },
  {
    feature: "Minimum Send",
    traditional: "$50 – $100",
    remitswap: "No minimum",
    highlight: false,
  },
  {
    feature: "Group Funding",
    traditional: "Not supported",
    remitswap: "Built-in",
    highlight: true,
  },
  {
    feature: "Transparency",
    traditional: "Hidden fees, opaque FX",
    remitswap: "Fully on-chain",
    highlight: false,
  },
  {
    feature: "Compliance",
    traditional: "Manual KYC paperwork",
    remitswap: "On-chain / World ID",
    highlight: false,
  },
  {
    feature: "Refund Policy",
    traditional: "Complex, days to process",
    remitswap: "Instant, trustless",
    highlight: false,
  },
];

export function Comparison() {
  return (
    <section className="border-t border-zinc-100 bg-white py-24 dark:border-zinc-800/50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4">
        {/* Section header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Why RemitSwap
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Traditional remittance vs. RemitSwap
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
            The average global remittance fee is 6.2%. We bring it below 1%
            with faster settlement and full transparency.
          </p>
        </div>

        {/* Comparison table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {/* Table header */}
          <div className="grid grid-cols-3 border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Feature
            </div>
            <div className="text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Traditional
            </div>
            <div className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              RemitSwap
            </div>
          </div>

          {/* Table body */}
          {rows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 items-center px-6 py-4 ${
                i < rows.length - 1
                  ? "border-b border-zinc-100 dark:border-zinc-800/50"
                  : ""
              }`}
            >
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {row.feature}
              </div>
              <div className="text-center text-sm text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-700">
                {row.traditional}
              </div>
              <div
                className={`text-center text-sm font-semibold ${
                  row.highlight
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {row.remitswap}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
