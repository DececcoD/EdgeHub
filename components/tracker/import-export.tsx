"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function ImportExportControls({ exportsEnabled }: { exportsEnabled: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<{ created: number; rejected: { rowNumber: number; reason: string }[] } | null>(null);

  async function handleFile(file: File) {
    const csv = await file.text();
    const res = await fetch("/api/v1/tracker/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv })
    });
    const json = await res.json();
    setReport(json);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Button variant="ghost" onClick={() => fileInput.current?.click()}>
          Import CSV
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (exportsEnabled) window.location.href = "/api/v1/tracker/export";
          }}
          disabled={!exportsEnabled}
          title={exportsEnabled ? "Export tracker as CSV" : "Exports require Pro or Elite"}
        >
          Export CSV
        </Button>
      </div>
      {report && (
        <p className="text-xs text-paper-muted dark:text-ink-muted">
          Imported {report.created} bet{report.created === 1 ? "" : "s"}.{" "}
          {report.rejected.length > 0 && (
            <span className="text-risk-text">
              {report.rejected.length} row{report.rejected.length === 1 ? "" : "s"} rejected: {report.rejected.map((r) => `#${r.rowNumber} (${r.reason})`).join(", ")}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
