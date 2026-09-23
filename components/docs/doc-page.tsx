export function DocPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <div className="prose prose-sm mt-6 flex flex-col gap-4 text-sm text-ink-950 dark:text-paper-50">{children}</div>
      <p className="mt-10 border-t border-paper-200 pt-4 text-xs text-paper-muted dark:border-ink-800 dark:text-ink-muted">
        {version} - published 2026-09-16
      </p>
    </div>
  );
}
