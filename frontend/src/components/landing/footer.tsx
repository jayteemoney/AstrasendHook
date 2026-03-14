"use client";

import { LogoMark } from "@/components/logo";

const links = {
  product: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Send Money", href: "/send" },
    { label: "Receive", href: "/receive" },
    { label: "History", href: "/history" },
  ],
  resources: [
    { label: "Documentation", href: "https://docs.uniswap.org", external: true },
    {
      label: "Smart Contracts",
      href: "https://sepolia.basescan.org",
      external: true,
    },
    {
      label: "GitHub",
      href: "https://github.com/jayteemoney/AstrasendHook",
      external: true,
    },
    {
      label: "Base Sepolia Explorer",
      href: "https://sepolia.basescan.org",
      external: true,
    },
  ],
  legal: [
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ],
};

const socials = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/jethro-irmiya-a2153427b/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68z" />
      </svg>
    ),
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/dev_jayteee",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/jayteemoney",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: "https://t.me/dev_jaytee",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.69 7.96c-.12.57-.45.71-.91.44l-2.52-1.86-1.21 1.17c-.13.13-.25.25-.51.25l.18-2.57 4.66-4.21c.2-.18-.04-.28-.31-.1L7.43 14.37l-2.48-.77c-.54-.17-.55-.54.11-.8l9.69-3.73c.45-.17.84.1.7.77z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <LogoMark size={32} />
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                AstraSend
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Low-cost, compliant cross-border remittances powered by Uniswap v4
              hooks on Base and Unichain.
            </p>
          </div>

          {/* Product links */}
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

          {/* Resources links */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Resources
            </h4>
            <ul className="space-y-2">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
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

        {/* Bottom bar — copyright + social icons */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-100 pt-8 sm:flex-row dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} AstraSend. Built for UHI8 Uniswap
            Hook Incubator. Powered by Uniswap&nbsp;v4&nbsp;&middot;&nbsp;Base&nbsp;&middot;&nbsp;Unichain.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
