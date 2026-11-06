import { useState, type FormEvent } from "react";
import { deleteTraining, saveTraining } from "@/lib/crm/data";
import { useAidyl, type Specialist } from "@/lib/store";
import { cn, uid } from "@/lib/utils";

const WHO = [
  { id: "randolph", label: "Randolph" },
  { id: "maya", label: "Maya" },
  { id: "both", label: "Both" },
] as const;

export function TrainingPanel({
  defaultAgent,
  crmSlug,
}: {
  defaultAgent: "randolph" | "maya";
  crmSlug?: string;
}) {
  const training = useAidyl((s) => s.training);
  const specialists = useAidyl((s) => s.specialists);
  const addSpecialist = useAidyl((s) => s.addSpecialist);
  const removeSpecialist = useAidyl((s) => s.removeSpecialist);
  const [agent, setAgent] = useState<"randolph" | "maya" | "both">(defaultAgent);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [specName, setSpecName] = useState("");
  const [specBrief, setSpecBrief] = useState("");

  const visible = training.filter((doc) => agent === "both" || doc.agent === agent || doc.agent === "both");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    setNote("");
    try {
      await saveTraining({ agent, title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setNote("Saved. They will use it the next time the question fits.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={add} className="space-y-4 rounded-3xl border border-line bg-surface p-5 lg:col-span-2">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">New lesson</p>
          <h2 className="mt-1 font-display text-3xl">Teach the desk</h2>
          <p className="mt-2 text-sm text-muted">
            A sentence is enough. Randolph and Maya read these notes plus the live tables. Aether stores each one.
          </p>
        </div>
        <div>
          <p className="text-sm">Who should learn it</p>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-bg p-1">
            {WHO.map((who) => (
              <button
                key={who.id}
                type="button"
                onClick={() => setAgent(who.id)}
                className={cn("rounded-full px-2 py-2 text-sm", agent === who.id ? "bg-ink text-paper" : "text-muted")}
              >
                {who.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deposits"
            className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          What they should know
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask for the deposit only after the vehicle and the lane are named."
            className="mt-1 min-h-36 w-full rounded-xl border border-line bg-bg px-3 py-2"
          />
        </label>
        <button disabled={busy} className="w-full rounded-full bg-ink px-4 py-3 text-sm text-paper disabled:opacity-60">
          {busy ? "Saving…" : "Add to their book"}
        </button>
        {note ? <p className="text-sm text-forest">{note}</p> : null}
        {crmSlug ? (
          <div className="border-t border-line pt-4">
            <h3 className="font-display text-xl">Add a specialist</h3>
            <p className="mt-1 text-sm text-muted">A new agent can take this company. Randolph still oversees them.</p>
            <input value={specName} onChange={(e) => setSpecName(e.target.value)} placeholder="Name" className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
            <textarea value={specBrief} onChange={(e) => setSpecBrief(e.target.value)} placeholder="What they own" className="mt-2 min-h-20 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
            <button
              type="button"
              className="mt-2 rounded-full border border-line px-3 py-2 text-sm"
              onClick={() => {
                if (!specName.trim() || !specBrief.trim()) return;
                const spec: Specialist = {
                  id: uid("agent"),
                  name: specName.trim(),
                  crmSlug,
                  brief: specBrief.trim(),
                  createdAt: new Date().toISOString(),
                };
                addSpecialist(spec);
                setSpecName("");
                setSpecBrief("");
              }}
            >
              Assign specialist
            </button>
            <ul className="mt-3 space-y-2">
              {specialists
                .filter((s) => s.crmSlug === crmSlug)
                .map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>
                      <strong>{s.name}</strong> — {s.brief}
                    </span>
                    <button type="button" className="text-clay" onClick={() => removeSpecialist(s.id)}>
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </form>
      <div className="space-y-3 lg:col-span-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">What they already know</h2>
          <p className="text-sm text-muted">{visible.length} notes</p>
        </div>
        {visible.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-surface px-4 py-8 text-sm text-muted">
            Nothing in this book yet. The first note is the one they will quote.
          </p>
        ) : null}
        {visible.map((doc) => (
          <article key={doc.id} className="rounded-3xl border border-line border-l-4 border-l-brass bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-brass uppercase">{doc.agent}</p>
                <h3 className="font-display text-xl">{doc.title}</h3>
              </div>
              <button
                className="text-sm text-clay"
                onClick={() => deleteTraining({ id: doc.id, lead_id: doc.lead_id, context_type: doc.context_type })}
              >
                Remove
              </button>
            </div>
            <p className="mt-2 text-sm">{doc.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
