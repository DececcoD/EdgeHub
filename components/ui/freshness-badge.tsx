import type { FreshnessState } from "@/lib/calc/freshness";
import clsx from "clsx";

/**
 * The freshness-pulse indicator - EdgeHub's one signature UI element,
 * dramatizing the product's core principle ("Freshness before flash: stale
 * data must never look current", Section 2.3) instead of hiding it in a
 * generic badge. Every state below maps 1:1 to Section 7.4.
 */

const LABEL: Record<FreshnessState, string> = {
  current: "Current",
  aging: "Aging",
  stale: "Stale",
  partial: "Partial",
  mapping_review: "Mapping review",
  unavailable: "Unavailable"
};

export function FreshnessDot({ state, className }: { state: FreshnessState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Data freshness: ${LABEL[state]}`}
      title={LABEL[state]}
      className={clsx("relative inline-flex h-2 w-2 shrink-0 items-center justify-center", className)}
    >
      {state === "current" && (
        <span className="h-2 w-2 rounded-full bg-signal animate-pulse-current" />
      )}
      {state === "aging" && (
        <span className="h-2 w-2 rounded-full bg-caution animate-pulse-aging" />
      )}
      {state === "stale" && <span className="h-2 w-2 rounded-full bg-paper-muted dark:bg-ink-muted" />}
      {state === "partial" && (
        <span className="h-2 w-2 rounded-full border border-dashed border-caution bg-transparent" />
      )}
      {state === "mapping_review" && (
        <span
          className="h-2 w-2 rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.info.DEFAULT)_0,theme(colors.info.DEFAULT)_1px,transparent_1px,transparent_2px)]"
          aria-hidden
        />
      )}
      {state === "unavailable" && <span className="text-[9px] font-bold leading-none text-risk-text">×</span>}
    </span>
  );
}

export function FreshnessBadge({ state, className }: { state: FreshnessState; className?: string }) {
  const tone =
    state === "current"
      ? "text-signal-text"
      : state === "aging"
      ? "text-caution-text"
      : state === "stale" || state === "unavailable"
      ? "text-risk-text"
      : "text-info-text";

  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-xs font-medium", tone, className)}>
      <FreshnessDot state={state} />
      {LABEL[state]}
    </span>
  );
}
