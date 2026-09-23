import Link from "next/link";
import clsx from "clsx";
import type { Plan } from "@/lib/types";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-xs border border-paper-200 bg-paper-0 dark:border-ink-800 dark:bg-ink-900", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-paper-200 px-4 py-3 dark:border-ink-800">
      <div>
        <h2 className="font-display text-sm font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-paper-muted dark:text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const buttonVariants = {
  primary: "bg-ink-950 text-paper-0 hover:bg-ink-800 dark:bg-signal dark:text-ink-950 dark:hover:opacity-90",
  secondary:
    "border border-paper-200 bg-paper-0 text-ink-950 hover:bg-paper-50 dark:border-ink-800 dark:bg-ink-900 dark:text-paper-50 dark:hover:bg-ink-800",
  ghost: "text-paper-muted hover:text-ink-950 dark:text-ink-muted dark:hover:text-paper-50",
  danger: "bg-risk-text text-paper-0 hover:opacity-90" // bg-risk (the vibrant DEFAULT) only reaches 3.67:1 against white text - fails AA's 4.5:1 for this button's 14px/medium-weight label
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return <button className={clsx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  className,
  children
}: {
  href: string;
  variant?: keyof typeof buttonVariants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={clsx(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

export function PlanBadge({ plan }: { plan: Plan }) {
  const label = plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Elite";
  const tone =
    plan === "free"
      ? "bg-paper-200 text-paper-muted dark:bg-ink-800 dark:text-ink-muted"
      : plan === "pro"
      ? "bg-info-soft text-info-text"
      : "bg-signal-soft text-signal-text";
  return <span className={clsx("rounded-xs px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tone)}>{label}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-display text-base font-medium">{title}</p>
      <p className="max-w-sm text-sm text-paper-muted dark:text-ink-muted">{description}</p>
      {action}
    </div>
  );
}

export function Metric({ label, value, tone }: { label: string; value: string; tone?: "signal" | "risk" | "caution" | "info" }) {
  const toneClass = tone ? { signal: "text-signal-text", risk: "text-risk-text", caution: "text-caution-text", info: "text-info-text" }[tone] : "";
  return (
    <div>
      <p className="text-xs text-paper-muted dark:text-ink-muted">{label}</p>
      <p className={clsx("font-mono tabular text-lg font-medium", toneClass)}>{value}</p>
    </div>
  );
}
