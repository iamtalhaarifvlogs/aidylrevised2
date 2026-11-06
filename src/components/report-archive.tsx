import { useState } from "react";
import { redownloadReport } from "@/lib/reports";
import { BUILTIN_CRMS } from "@/lib/crm/registry";
import { useAidyl } from "@/lib/store";

function moduleName(module: string) {
  if (module === "all" || module === "*" || module === "desk") return "Whole desk";
  return BUILTIN_CRMS.find((crm) => crm.slug === module)?.name ?? module;
}

export function ReportArchive({ module }: { module?: string }) {
  const reports = useAidyl((s) => s.reports);
  const list = module ? reports.filter((item) => item.module === module) : reports;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function again(id: string) {
    const report = list.find((item) => item.id === id);
    if (!report) return;
    setBusy(id);
    setError("");
    try {
      await redownloadReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rebuild that report.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mb-6">
      <h2 className="font-display text-2xl">Previous reports</h2>
      <p className="mt-1 text-sm text-muted">Every report from this desk or from chat stays here. Download it again whenever you need the file.</p>
      {error ? <p className="mt-2 text-sm text-clay">{error}</p> : null}
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {list.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No reports yet. The next one you generate is kept.</li> : null}
        {list.map((report) => (
          <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm">{report.title}</p>
              <p className="text-xs text-muted">
                {new Date(report.at).toLocaleString()} · {report.agent} · {moduleName(report.module)}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === report.id}
              onClick={() => void again(report.id)}
              className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-60"
            >
              {busy === report.id ? "Building…" : "Download again"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
