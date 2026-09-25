"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/markets", label: "Markets" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/analyzer", label: "Analyzer" },
  { href: "/predictions", label: "Predictions" },
  { href: "/tracker", label: "Tracker" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
  { href: "/learn", label: "Learn" },
  { href: "/account", label: "Account" }
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-48 flex-col gap-0.5 border-r border-paper-200 bg-paper-0 px-2 py-4 dark:border-ink-800 dark:bg-ink-900">
      <Link href="/dashboard" className="mb-4 px-2 font-display text-base font-bold tracking-tight">
        EdgeHub
      </Link>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-xs px-2 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-ink-950 text-paper-0 dark:bg-signal dark:text-ink-950"
                : "text-paper-muted hover:bg-paper-50 hover:text-ink-950 dark:text-ink-muted dark:hover:bg-ink-800 dark:hover:text-paper-50"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto px-2 pt-4 text-[11px] text-paper-muted dark:text-ink-muted">
        <Link href="/admin" className="hover:underline">
          Admin console
        </Link>
      </div>
    </nav>
  );
}
