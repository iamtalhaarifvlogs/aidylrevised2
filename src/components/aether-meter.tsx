import { useAidyl } from "@/lib/store";

export function AetherMeter() {
  const run = useAidyl((s) => s.aetherRun);
  const lastCheck = useAidyl((s) => s.tableWatch.lastCheck);
  const lastError = useAidyl((s) => s.tableWatch.lastError);
  const active = run.reading || (!lastCheck && !lastError);
  if (!active) return null;
  const determinate = run.reading;
  const pct = determinate ? Math.max(8, Math.min(100, Math.round((run.step / Math.max(run.total, 1)) * 100))) : 0;
  const label = run.label || "Opening the book";
  return (
    <div className="border-b border-line bg-surface px-4 py-3" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 text-xs">
        <span className="text-brass">Aether is reading</span>
        <span className="min-w-0 truncate text-muted">{label}</span>
      </div>
      <div
        className="mx-auto mt-2 h-1.5 max-w-3xl overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={run.total}
        aria-valuenow={determinate ? run.step : 0}
        aria-label="Aether reading the book"
      >
        {determinate ? (
          <div className="aidyl-meter h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
        ) : (
          <div className="aidyl-scan h-full rounded-full bg-brass" />
        )}
      </div>
    </div>
  );
}
