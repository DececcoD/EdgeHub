"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface HistoryPoint {
  at: string;
  decimalOdds: number;
  gapBefore: boolean;
}

/**
 * ANL-02: "Chart never connects across known data gaps without marking the
 * gap." Recharts draws a straight line across any null-valued point, so we
 * split the series into segments at each flagged gap and render one <Line>
 * per segment - there is no path connecting across a gap because no single
 * Line element spans it.
 */
export function LineHistoryChart({ points }: { points: HistoryPoint[] }) {
  const segments: HistoryPoint[][] = [];
  let current: HistoryPoint[] = [];
  for (const p of points) {
    if (p.gapBefore && current.length) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);

  const allData = points.map((p) => ({ at: p.at, label: new Date(p.at).toLocaleTimeString(undefined, { hour: "numeric" }) }));
  const gapIndices = new Set(points.filter((p) => p.gapBefore).map((p) => p.at));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={allData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="2 4" className="stroke-paper-200 dark:stroke-ink-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            formatter={(value: number) => [value.toFixed(2), "Decimal odds"]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload ? new Date(payload[0].payload.at).toLocaleString() : "")}
          />
          {segments.map((segment, i) => (
            <Line
              key={i}
              data={segment.map((p) => ({ at: p.at, label: new Date(p.at).toLocaleTimeString(undefined, { hour: "numeric" }), decimalOdds: p.decimalOdds }))}
              dataKey="decimalOdds"
              type="monotone"
              stroke="#4C7DF0"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {gapIndices.size > 0 && (
        <p className="mt-1 text-[11px] text-caution-text">
          {gapIndices.size} data gap{gapIndices.size === 1 ? "" : "s"} in this window - segments are drawn separately rather than
          interpolated across missing observations.
        </p>
      )}
    </div>
  );
}
