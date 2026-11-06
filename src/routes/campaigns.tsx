import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { posterSvg, wrapWords, type Campaign, type CampaignStatus } from "@/lib/campaigns";
import {
  applyCampaignDecision,
  considerCampaigns,
  saveAdminDraft,
  saveCampaignEdit,
  saveCampaignResult,
  setCampaignPause,
} from "@/lib/campaign-desk";
import { useAidyl } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/campaigns")({ component: CampaignsPage });

const FILTERS: { id: "waiting" | "approved" | "rejected" | "completed" | "all"; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Refused" },
  { id: "completed", label: "Results" },
  { id: "all", label: "All" },
];

function waiting(status: CampaignStatus) {
  return status === "proposed" || status === "revision" || status === "deferred";
}

function statusLabel(status: CampaignStatus) {
  if (status === "proposed") return "Awaiting you";
  if (status === "revision") return "Revision asked";
  if (status === "approved") return "Approved, not launched";
  if (status === "rejected") return "Refused";
  if (status === "deferred") return "Saved for later";
  return "Result recorded";
}

function Poster({ campaign }: { campaign: Campaign }) {
  const title = wrapWords(campaign.title, 22).slice(0, 5);
  const message = wrapWords(campaign.message, 34).slice(0, 3);
  return (
    <svg viewBox="0 0 360 480" role="img" aria-label={campaign.title} className="h-auto w-full rounded-md border border-line bg-paper">
      <rect width="360" height="480" fill="#f7f1e6" />
      <rect width="360" height="10" fill="#8c6239" />
      <text x="28" y="46" fill="#8c6239" fontFamily="Outfit, sans-serif" fontSize="12" letterSpacing="3">
        CARSHIPY
      </text>
      <text x="28" y="70" fill="#6f675e" fontFamily="Outfit, sans-serif" fontSize="12">
        {campaign.analyst === "maya" ? "Maya" : "Randolph"} · proposal
      </text>
      {title.map((line, index) => (
        <text key={line + index} x="28" y={150 + index * 32} fill="#1c1915" fontFamily="Fraunces, Georgia, serif" fontSize="26">
          {line}
        </text>
      ))}
      <rect x="28" y="320" width="48" height="3" fill="#1f4d3a" />
      {message.map((line, index) => (
        <text key={line + index} x="28" y={352 + index * 20} fill="#1f4d3a" fontFamily="Outfit, sans-serif" fontSize="14">
          {line}
        </text>
      ))}
      <text x="28" y="456" fill="#6f675e" fontFamily="Outfit, sans-serif" fontSize="11">
        Not published. Nothing is spent.
      </text>
    </svg>
  );
}

function CampaignsPage() {
  const campaigns = useAidyl((s) => s.campaigns);
  const sync = useAidyl((s) => s.campaignSync);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("waiting");
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [contacted, setContacted] = useState("");
  const [completed, setCompleted] = useState("");
  const [spend, setSpend] = useState("");
  const [resultNote, setResultNote] = useState("");

  useEffect(() => {
    void considerCampaigns().catch((err) => setError(err instanceof Error ? err.message : "The book did not answer."));
  }, []);

  const visible = campaigns.filter((item) => {
    if (filter === "all") return true;
    if (filter === "waiting") return waiting(item.status);
    if (filter === "approved") return item.status === "approved";
    if (filter === "rejected") return item.status === "rejected";
    return item.status === "completed";
  });
  const current = campaigns.find((item) => item.cp_id === (selected || visible[0]?.cp_id)) ?? visible[0] ?? null;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPoster(campaign: Campaign) {
    const blob = new Blob([posterSvg(campaign)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${campaign.cp_id}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="px-4 py-8 md:px-8">
      <p className="text-xs tracking-[0.18em] text-brass uppercase">Campaign intelligence</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl leading-none md:text-5xl">Proposals from the book, not from a blank page.</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Maya and Randolph read the live Carshipy rows and file a proposal when the count supports one. You can also tell either of them, in the chat, who it is for and what the line should say. They file that conversation as a proposal too. Forecasts stay labelled. Approving a proposal does not publish an ad, contact a customer, or spend money.
      </p>
      {sync.state === "missing" ? (
        <p className="mt-4 max-w-2xl border border-clay/40 bg-clay-soft px-4 py-3 text-sm text-clay">
          The live gateway does not have tbl_campaigns yet. It answered: {sync.detail || "Requested resource not found"}. Proposals stay on this desk until that table exists in the same account, with partition key cp_id. Nothing here is pretending to be a live Dynamo row.
        </p>
      ) : null}
      {sync.state === "error" ? <p className="mt-4 max-w-2xl text-sm text-clay">{sync.detail}</p> : null}
      {sync.state === "live" ? <p className="mt-4 text-sm text-forest">Proposals are writing to tbl_campaigns.</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || sync.paused}
          className="rounded-md bg-ink px-3 py-2 text-sm text-paper disabled:opacity-50"
          onClick={() => void run(() => considerCampaigns(true))}
        >
          Read the book and propose
        </button>
        <button
          type="button"
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          onClick={() => setCampaignPause(!sync.paused)}
        >
          {sync.paused ? "Proposals are paused" : "Pause new proposals"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              filter === item.id ? "border-ink bg-ink text-paper" : "border-line bg-surface",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-8 max-w-xl text-muted">Nothing in this list. If the book has no qualifying pattern, the desk stays quiet rather than invent a campaign.</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={item.cp_id}>
                <button
                  type="button"
                  onClick={() => setSelected(item.cp_id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left",
                    current?.cp_id === item.cp_id ? "border-brass bg-brass-soft" : "border-line bg-surface",
                  )}
                >
                  <p className="font-display text-lg leading-tight">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.analyst === "maya" ? "Maya" : "Randolph"} · {statusLabel(item.status)} · {item.priority_score}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {current ? <Detail campaign={current} note={note} setNote={setNote} busy={busy} run={run} download={() => downloadPoster(current)} contacted={contacted} setContacted={setContacted} completed={completed} setCompleted={setCompleted} spend={spend} setSpend={setSpend} resultNote={resultNote} setResultNote={setResultNote} /> : null}
        </div>
      )}
      <form
        className="mt-10 max-w-xl space-y-3 border-t border-line pt-8"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (title.trim().length < 3 || message.trim().length < 3) throw new Error("Give the draft a title and a message.");
            await saveAdminDraft({ title, audience, message });
            setTitle("");
            setAudience("");
            setMessage("");
            setFilter("waiting");
          });
        }}
      >
        <h2 className="font-display text-2xl">Write one yourself</h2>
        <p className="text-sm text-muted">An administrator draft is marked as yours. It is not counted from the book, and it still does not launch anything.</p>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full rounded-md border border-line bg-surface px-3 py-2" />
        <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Who it is for" className="w-full rounded-md border border-line bg-surface px-3 py-2" />
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="The message" className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2" />
        <button type="submit" disabled={busy} className="rounded-md bg-brass px-3 py-2 text-sm text-paper disabled:opacity-50">
          File the draft
        </button>
      </form>
    </main>
  );
}

function Detail({
  campaign,
  note,
  setNote,
  busy,
  run,
  download,
  contacted,
  setContacted,
  completed,
  setCompleted,
  spend,
  setSpend,
  resultNote,
  setResultNote,
}: {
  campaign: Campaign;
  note: string;
  setNote: (value: string) => void;
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<void>;
  download: () => void;
  contacted: string;
  setContacted: (value: string) => void;
  completed: string;
  setCompleted: (value: string) => void;
  spend: string;
  setSpend: (value: string) => void;
  resultNote: string;
  setResultNote: (value: string) => void;
}) {
  const [title, setTitle] = useState(campaign.title);
  const [audience, setAudience] = useState(campaign.audience);
  const [message, setMessage] = useState(campaign.message);
  useEffect(() => {
    setTitle(campaign.title);
    setAudience(campaign.audience);
    setMessage(campaign.message);
  }, [campaign.cp_id, campaign.title, campaign.audience, campaign.message]);
  const open = campaign.status === "proposed" || campaign.status === "revision" || campaign.status === "deferred";
  return (
    <article className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div>
        <Poster campaign={campaign} />
        <button type="button" onClick={download} className="mt-2 text-sm text-brass">
          Download the visual
        </button>
        <p className="mt-2 text-xs text-muted">
          SVG composed on the desk from this brief. No image model is configured, so this is not a generated photograph.
        </p>
      </div>
      <div className="space-y-4">
        <p className="text-xs tracking-wide text-brass uppercase">{statusLabel(campaign.status)} · {campaign.cp_id}</p>
        <h2 className="font-display text-3xl leading-tight">{campaign.title}</h2>
        <p>{campaign.why_now}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Objective</dt>
            <dd>{campaign.objective}</dd>
          </div>
          <div>
            <dt className="text-muted">Audience</dt>
            <dd>{campaign.audience}</dd>
          </div>
          <div>
            <dt className="text-muted">Channels</dt>
            <dd>{campaign.channels}</dd>
          </div>
          <div>
            <dt className="text-muted">Budget</dt>
            <dd>{campaign.budget_note}</dd>
          </div>
        </dl>
        <section>
          <h3 className="font-display text-xl">Evidence</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {campaign.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="font-display text-xl">Forecast · {campaign.forecast.label}</h3>
          <p className="mt-1 text-sm">{campaign.forecast.baseline}</p>
          <p className="mt-1 text-sm text-muted">{campaign.forecast.limitations.join(" ")}</p>
          {campaign.lesson_in ? <p className="mt-2 text-sm">Prior result used: {campaign.lesson_in}</p> : null}
        </section>
        <section>
          <h3 className="font-display text-xl">Why this rank · {campaign.priority_score}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {campaign.priority_factors.map((factor) => (
              <li key={factor.factor}>
                <span className="text-muted">{factor.factor} {factor.weight}.</span> {factor.note}
              </li>
            ))}
          </ul>
        </section>
        <p className="text-sm">{campaign.risks}</p>
        <p className="text-sm text-muted">{campaign.activities}</p>
        {open ? (
          <div className="space-y-2 border-t border-line pt-4">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-md border border-line bg-surface px-3 py-2" />
            <textarea value={audience} onChange={(event) => setAudience(event.target.value)} className="min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2" />
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2" />
            <button type="button" disabled={busy} className="text-sm text-brass" onClick={() => void run(() => saveCampaignEdit(campaign.cp_id, { title, audience, message }))}>
              Save the edit
            </button>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="A note for the decision" className="min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className="rounded-md bg-forest px-3 py-2 text-sm text-paper" onClick={() => void run(() => applyCampaignDecision(campaign.cp_id, "approve", note))}>
                Approve
              </button>
              <button type="button" disabled={busy} className="rounded-md bg-clay px-3 py-2 text-sm text-paper" onClick={() => void run(() => applyCampaignDecision(campaign.cp_id, "reject", note))}>
                Refuse
              </button>
              <button type="button" disabled={busy} className="rounded-md border border-line px-3 py-2 text-sm" onClick={() => void run(() => applyCampaignDecision(campaign.cp_id, "defer", note))}>
                Save for later
              </button>
              <button type="button" disabled={busy} className="rounded-md border border-line px-3 py-2 text-sm" onClick={() => void run(() => applyCampaignDecision(campaign.cp_id, "revision", note))}>
                Ask for a revision
              </button>
            </div>
            <p className="text-xs text-muted">Approve records your decision. It does not launch the campaign.</p>
          </div>
        ) : null}
        {campaign.decision_note ? <p className="text-sm">Decision note: {campaign.decision_note}</p> : null}
        {campaign.status === "approved" || campaign.status === "completed" ? (
          <form
            className="space-y-2 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => saveCampaignResult(campaign.cp_id, { contacted, completed, spend, note: resultNote }));
            }}
          >
            <h3 className="font-display text-xl">What actually happened</h3>
            <p className="text-sm text-muted">The original forecast stays as it was written. This result is compared with it and kept for the next similar proposal.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={contacted} onChange={(event) => setContacted(event.target.value)} placeholder="Contacted" className="rounded-md border border-line bg-surface px-3 py-2" />
              <input value={completed} onChange={(event) => setCompleted(event.target.value)} placeholder="Briefs completed" className="rounded-md border border-line bg-surface px-3 py-2" />
              <input value={spend} onChange={(event) => setSpend(event.target.value)} placeholder="Spend, if any" className="rounded-md border border-line bg-surface px-3 py-2" />
            </div>
            <textarea value={resultNote} onChange={(event) => setResultNote(event.target.value)} placeholder="What differed" className="min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2" />
            <button type="submit" disabled={busy} className="rounded-md bg-ink px-3 py-2 text-sm text-paper">
              Record the result
            </button>
            {campaign.lesson ? <p className="text-sm">{campaign.lesson}</p> : null}
          </form>
        ) : null}
      </div>
    </article>
  );
}
