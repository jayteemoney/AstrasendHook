"use client";

const links = {
  product: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Send Money", href: "/send" },
    { label: "Receive", href: "/receive" },
    { label: "History", href: "/history" },
  ],
  resources: [
    { label: "Documentation", href: "#" },
    { label: "Smart Contracts", href: "#" },
    { label: "GitHub", href: "#" },
    { label: "Base Sepolia Explorer", href: "https://sepolia.basescan.org" },
  ],
  legal: [
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                R
              </div>
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                RemitSwap
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Low-cost, compliant cross-border remittances powered by Uniswap v4
              on Base.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Product
            </h4>
            <ul className="space-y-2">
              {links.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Resources
            </h4>
            <ul className="space-y-2">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Legal
            </h4>
            <ul className="space-y-2">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-zinc-100 pt-8 sm:flex-row dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} RemitSwap. Built for UHI8 Uniswap
            Hook Incubator.
          </p>
          <p className="mt-2 text-xs text-zinc-400 sm:mt-0">
            Powered by Uniswap v4 &middot; Deployed on Base
          </p>
        </div>
      </div>
    </footer>
  );
}
