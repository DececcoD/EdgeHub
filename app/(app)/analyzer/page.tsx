import Link from "next/link";
import { listOpportunities } from "@/lib/data-source";
import { EmptyState, Panel } from "@/components/ui/primitives";

export default async function AnalyzerIndexPage() {
  const rows = (await listOpportunities()).slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl">
      <Panel>
        <EmptyState
          title="Pick a market to analyze"
          description="Open any row from Markets or Opportunities, or jump into one of today's top-ranked markets below."
          action={
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {rows.map((r) => (
                <li key={r.outcomeId}>
                  <Link href={`/analyzer/${r.outcomeId}`} className="text-info-text hover:underline">
                    {r.event.away.name} @ {r.event.home.name} - {r.outcomeLabel}
                  </Link>
                </li>
              ))}
            </ul>
          }
        />
      </Panel>
    </div>
  );
}
