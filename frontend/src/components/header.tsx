"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/history", label: "History" },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              R
            </div>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              RemitSwap
            </span>
          </Link>

          {isConnected && (
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ConnectKitButton />
        </div>
      </div>

      {/* Mobile nav */}
      {isConnected && (
        <nav className="flex border-t border-zinc-100 px-4 md:hidden dark:border-zinc-800">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                  isActive
                    ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-500"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
