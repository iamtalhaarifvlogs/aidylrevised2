import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTable } from "@/lib/crm/gateway.functions";
import { useAidyl } from "@/lib/store";
import { cellText } from "@/lib/utils";

export const Route = createFileRoute("/workflow")({ component: WorkflowPage });

type Tone = "all" | "agent" | "decision" | "write";

type Entry = {
  id: string;
  at: string;
  who: string;
  where: string;
  text: string;
  tone: Exclude<Tone, "all">;
};

function timeOf(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function WorkflowPage() {
  const activity = useAidyl((s) => s.activity);
  const beats = useAidyl((s) => s.beats);
  const decisions = useAidyl((s) => s.decisions);
  const [tone, setTone] = useState<Tone>("all");
  const logs = useQuery({
    queryKey: ["crm", "tbl_workflow_logs"],
    queryFn: () => listTable({ data: { table: "tbl_workflow_logs" } }),
  });

  const entries = useMemo(() => {
    const rows: Entry[] = [
      ...activity.map((event) => ({
        id: event.id,
        at: event.at,
        who: event.agent || event.performedBy,
        where: event.crm,
        text: event.message,
        tone: (event.agent ? "agent" : "write") as Entry["tone"],
      })),
      ...beats.map((beat) => ({
        id: beat.id,
        at: beat.at,
        who: beat.agent,
        where: beat.phase,
        text: beat.text,
        tone: "agent" as const,
      })),
      ...decisions.map((decision) => ({
        id: decision.id,
        at: decision.at,
        who: decision.by,
        where: decision.choice,
        text: decision.note || decision.kind,
        tone: "decision" as const,
      })),
      ...(logs.data?.items ?? []).map((row, index) => ({
        id: `log-${String(row.timestamp)}-${index}`,
        at: cellText(row.timestamp),
        who: cellText(row.performed_by),
        where: cellText(row.workflowName || row.action),
        text: cellText(row.message || row.action),
        tone: "write" as const,
      })),
    ];
    return rows.sort((a, b) => timeOf(b.at) - timeOf(a.at));
  }, [activity, beats, decisions, logs.data?.items]);

  const shown = tone === "all" ? entries : entries.filter((entry) => entry.tone === tone);

  return (
    <main className="px-4 py-6 md:px-8">
      <p className="text-xs tracking-[0.18em] text-brass uppercase">Audit</p>
      <h1 className="font-display text-4xl">Workflow</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Everything the desk has done: agent watches, recommendations, your decisions, and rows written to Carshipy’s workflow log. This is the whole system, not one company.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "Everything"],
            ["agent", "Agents"],
            ["decision", "Decisions"],
            ["write", "Writes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTone(id)}
            className={`rounded-full px-4 py-2 text-sm ${tone === id ? "bg-ink text-paper" : "border border-line bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {logs.isLoading ? <p className="mt-4 text-sm text-muted">Loading the live workflow table…</p> : null}
      {logs.error ? <p className="mt-4 text-sm text-clay">The live workflow table did not answer. Console history is still below.</p> : null}
      <ol className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {shown.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Nothing in this cut yet.</li> : null}
        {shown.map((entry) => (
          <li key={entry.id} className="px-4 py-3">
            <p className="text-sm">{entry.text}</p>
            <p className="text-xs text-muted">
              {timeOf(entry.at) ? new Date(entry.at).toLocaleString() : "Time not recorded"} · {entry.who} · {entry.where} · {entry.tone}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
