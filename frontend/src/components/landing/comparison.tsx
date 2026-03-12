"use client";

const rows = [
  {
    feature: "Total Fee",
    traditional: "6 – 15%",
    astrasend: "< 1%",
    highlight: true,
  },
  {
    feature: "Settlement Time",
    traditional: "1 – 5 business days",
    astrasend: "~2 seconds",
    highlight: true,
  },
  {
    feature: "Availability",
    traditional: "Business hours only",
    astrasend: "24/7/365",
    highlight: false,
  },
  {
    feature: "Minimum Send",
    traditional: "$50 – $100",
    astrasend: "No minimum",
    highlight: false,
  },
  {
    feature: "Group Funding",
    traditional: "Not supported",
    astrasend: "Built-in",
    highlight: true,
  },
  {
    feature: "Transparency",
    traditional: "Hidden fees, opaque FX",
    astrasend: "Fully on-chain",
    highlight: false,
  },
  {
    feature: "Compliance",
    traditional: "Manual KYC paperwork",
    astrasend: "On-chain / World ID",
    highlight: false,
  },
  {
    feature: "Refund Policy",
    traditional: "Complex, days to process",
    astrasend: "Instant, trustless",
    highlight: false,
  },
];

export function Comparison() {
  return (
    <section className="border-t border-zinc-100 bg-white py-16 sm:py-24 dark:border-zinc-800/50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4">
        {/* Section header */}
        <div className="mb-10 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Why AstraSend
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
            Traditional remittance vs. AstraSend
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
            The average global remittance fee is 6.2%. We bring it below 1%
            with faster settlement and full transparency.
          </p>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="min-w-[400px]">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-zinc-200 bg-zinc-50 px-3 py-3 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-xs font-semibold text-zinc-500 sm:text-sm dark:text-zinc-400">
                Feature
              </div>
              <div className="text-center text-xs font-semibold text-zinc-500 sm:text-sm dark:text-zinc-400">
                Traditional
              </div>
              <div className="text-center text-xs font-semibold text-emerald-600 sm:text-sm dark:text-emerald-400">
                AstraSend
              </div>
            </div>

            {/* Table body */}
            {rows.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 items-center px-3 py-3 sm:px-6 sm:py-4 ${
                  i < rows.length - 1
                    ? "border-b border-zinc-100 dark:border-zinc-800/50"
                    : ""
                }`}
              >
                <div className="text-xs font-medium text-zinc-900 sm:text-sm dark:text-zinc-100">
                  {row.feature}
                </div>
                <div className="text-center text-xs text-zinc-400 line-through decoration-zinc-300 sm:text-sm dark:text-zinc-500 dark:decoration-zinc-700">
                  {row.traditional}
                </div>
                <div
                  className={`text-center text-xs font-semibold sm:text-sm ${
                    row.highlight
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {row.astrasend}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
