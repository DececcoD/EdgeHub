"use client";

import { useState } from "react";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { AnalysisOutput } from "@/lib/ai/schema";

export function ExplanationPanel({ outcomeId }: { outcomeId: string }) {
  const [output, setOutput] = useState<AnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function request() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/outcomes/${outcomeId}/explain`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Explanation unavailable.");
        return;
      }
      setOutput(json.output);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="AI explanation"
        subtitle="Grounded in structured evidence only - never a prediction"
        action={
          <Button variant="secondary" onClick={request} disabled={loading}>
            {loading ? "Generating..." : output ? "Regenerate" : "Explain this market"}
          </Button>
        }
      />
      <div className="p-4 text-sm">
        {error && <p className="text-risk-text">{error}</p>}
        {!output && !error && !loading && (
          <p className="text-paper-muted dark:text-ink-muted">
            Request a plain-language read of the current evidence: consensus, edge, EV, and any data limitations.
          </p>
        )}
        {output && (
          <div className="flex flex-col gap-3">
            <p>{output.summary}</p>
            {output.supportingFactors.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">Supporting factors</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {output.supportingFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-risk-text">Risk factors</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {output.riskFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            {output.dataLimitations.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-caution-text">Data limitations</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {output.dataLimitations.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-paper-muted dark:text-ink-muted">{output.metricExplanation}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">
              {output.safetyLabel} - generated {new Date(output.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
