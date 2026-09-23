import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/methodology", label: "Methodology" },
  { href: "/faq", label: "FAQ" },
  { href: "/responsible-use", label: "Responsible use" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" }
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-paper-200 px-6 py-4 dark:border-ink-800">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          EdgeHub
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link href="/calculator" className="hover:underline">
            Calculator
          </Link>
          <Link href="/faq" className="hover:underline">
            FAQ
          </Link>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="rounded-xs bg-ink-950 px-3 py-1.5 text-paper-0 hover:bg-ink-800 dark:bg-signal dark:text-ink-950">
            Start free
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-paper-200 px-6 py-6 text-xs text-paper-muted dark:border-ink-800 dark:text-ink-muted">
        <p className="mb-3 max-w-2xl">
          EdgeHub provides market-intelligence information and tracking tools. It does not accept, route, or execute
          wagers, does not custody funds, and does not represent itself as a sportsbook or exchange. Nothing here is a
          guarantee of any outcome.
        </p>
        <nav className="flex flex-wrap gap-4">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
