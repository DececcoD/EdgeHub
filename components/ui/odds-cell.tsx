"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { formatAmerican, formatDecimalOdds } from "@/lib/calc/format";
import type { OddsFormat } from "@/lib/types";

/**
 * Every price in the product renders through this component so the numeral
 * language stays consistent (tabular monospace) and so a value change gets
 * the same tick-up/tick-down flash everywhere - the other half of the
 * freshness-pulse signature (see freshness-badge.tsx).
 */
export function OddsCell({
  american,
  decimal,
  format = "american",
  className
}: {
  american: number;
  decimal: number;
  format?: OddsFormat;
  className?: string;
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(decimal);

  useEffect(() => {
    if (prev.current !== decimal) {
      setFlash(decimal > prev.current ? "up" : "down");
      prev.current = decimal;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [decimal]);

  return (
    <span
      className={clsx(
        "inline-block rounded-xs px-1 font-mono tabular text-sm",
        flash === "up" && "animate-tick-up",
        flash === "down" && "animate-tick-down",
        className
      )}
    >
      {format === "american" ? formatAmerican(american) : formatDecimalOdds(decimal)}
    </span>
  );
}
