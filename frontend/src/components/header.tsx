"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";

const navLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/send",
    label: "Send",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4z" /><path d="m22 2-11 11" />
      </svg>
    ),
  },
  {
    href: "/receive",
    label: "Receive",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v14M5 9l7 7 7-7" /><path d="M5 22h14" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              A
            </div>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              AstraSend
            </span>
          </Link>

          {isConnected && (
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
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

      {/* Mobile bottom nav */}
      {isConnected && (
        <nav className="flex border-t border-zinc-100 px-2 md:hidden dark:border-zinc-800">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-center transition-colors ${
                  isActive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                <span className={isActive ? "text-emerald-600 dark:text-emerald-400" : ""}>
                  {link.icon}
                </span>
                <span className={`text-[10px] font-medium ${isActive ? "border-b-2 border-emerald-600 dark:border-emerald-400" : ""}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
