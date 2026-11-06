import { useState } from "react";
import { applyDecision } from "@/lib/intelligence";
import { useAidyl, type Recommendation, type SuggestedAction } from "@/lib/store";

const tone: Record<Recommendation["priority"], string> = {
  urgent: "border-clay bg-clay-soft",
  warning: "border-brass bg-brass-soft",
  recommend: "border-forest bg-forest-soft",
  info: "border-line bg-surface",
};

export function RecommendationList() {
  const items = useAidyl((s) => s.recommendations);
  const open = items.filter((item) => item.status === "open" || item.status === "deferred" || item.status === "modified");
  const closed = items.filter((item) => !open.includes(item)).slice(0, 4);
  return (
    <div id="decisions" className="space-y-3">
      {open.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-5 text-sm text-muted">
          No recommendation is waiting. Aether is watching the live Carshipy tables. Existing rows are not re-announced.
        </p>
      ) : null}
      {open.map((item) => (
        <RecommendationCard key={item.id} item={item} />
      ))}
      {closed.length ? (
        <div className="pt-2">
          <p className="text-xs tracking-[0.14em] text-muted uppercase">Decided</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {closed.map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <span className="text-muted">{item.status} · </span>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RecommendationCard({ item }: { item: Recommendation }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function run(choice: "approve" | "reject" | "modify" | "defer", actionId?: SuggestedAction["id"]) {
    setBusy(true);
    setResult("");
    try {
      const text = await applyDecision(item.id, choice, { actionId, note });
      setResult(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`aidyl-panel rounded-xl border px-4 py-4 ${tone[item.priority]}`}>
      <p className="text-xs tracking-[0.14em] uppercase">
        {item.analyst === "maya" ? "Maya" : "Randolph"} · {item.priority} · recommendation
      </p>
      <h3 className="mt-1 font-display text-2xl leading-tight">{item.title}</h3>
      <p className="mt-2 text-sm">{item.summary}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {item.evidence.map((line) => (
          <li key={line}>Evidence: {line}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm">Suggested action: {item.suggestion}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.actions.map((action) => (
          <button
            key={action.id}
            disabled={busy}
            onClick={() => void run("approve", action.id)}
            className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
        <button disabled={busy} onClick={() => void run("reject")} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
          Reject
        </button>
        <button disabled={busy} onClick={() => void run("defer")} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
          Defer
        </button>
        <button disabled={busy} onClick={() => void run("modify")} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
          Save note
        </button>
        <a href={item.href} className="rounded-full px-4 py-2 text-sm text-brass">
          Open the record
        </a>
      </div>
      <label className="mt-3 block text-xs text-muted">
        Modify the instruction before you approve it
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>
      {result ? <p className="mt-2 text-sm">{result}</p> : null}
    </article>
  );
}
