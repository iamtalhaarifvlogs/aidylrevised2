import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { RecommendationList } from "@/components/recommendations";
import { listTable } from "@/lib/crm/gateway.functions";
import { BUILTIN_CRMS, slugify } from "@/lib/crm/registry";
import { commandBrief } from "@/lib/intelligence";
import { useAidyl } from "@/lib/store";
import { asNumber, money } from "@/lib/utils";

const LIFE = [
  { label: "Lead", test: /disc|new|self|unset|^$/i },
  { label: "Qualification", test: /qual|hand/i },
  { label: "Vehicle", test: /sourc|vehicle/i },
  { label: "Pricing", test: /pric/i },
  { label: "Financing", test: /financ/i },
  { label: "Transaction", test: /deposit|transact/i },
  { label: "Shipping", test: /book|ship/i },
  { label: "Tracking", test: /transit|track/i },
  { label: "Complete", test: /deliver|complete|closed/i },
];

export function stageBucket(stage: string) {
  const value = stage || "";
  return LIFE.find((step) => step.test.test(value))?.label ?? "Lead";
}

export function CommandCenter() {
  const custom = useAidyl((s) => s.customCrms);
  const addCrm = useAidyl((s) => s.addCrm);
  const recommendations = useAidyl((s) => s.recommendations);
  const beats = useAidyl((s) => s.beats);
  const controls = useAidyl((s) => s.controls);
  const setControls = useAidyl((s) => s.setControls);
  const social = useAidyl((s) => s.socialWatch.snapshot);
  const ig = useAidyl((s) => s.igWatch.snapshot);
  const tableWatch = useAidyl((s) => s.tableWatch);
  const run = useAidyl((s) => s.aetherRun);
  const leads = useQuery({ queryKey: ["crm", "tbl_leads"], queryFn: () => listTable({ data: { table: "tbl_leads" } }) });
  const ships = useQuery({ queryKey: ["crm", "tbl_shipment"], queryFn: () => listTable({ data: { table: "tbl_shipment" } }) });
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [error, setError] = useState("");
  const items = leads.data?.items ?? [];
  const pipeline = items.reduce((sum, row) => sum + (asNumber(row.budget) ?? 0), 0);
  const buckets = new Map<string, number>();
  for (const row of items) {
    const label = stageBucket(String(row.stage ?? ""));
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  const companies = [...BUILTIN_CRMS, ...custom.map((crm) => ({ ...crm, live: false }))];

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const slug = slugify(name);
    if (!slug || !focus.trim()) {
      setError("Name and a one-line focus are required.");
      return;
    }
    if (slug === "ogamoto" || companies.some((c) => c.slug === slug)) {
      setError("That module already exists. Ogamoto now lives inside Carshipy.");
      return;
    }
    addCrm({ slug, name: name.trim(), focus: focus.trim() });
    setName("");
    setFocus("");
    setError("");
  }

  async function allowNotifications() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
  }

  return (
    <main>
      <header className="border-b border-line px-4 py-8 md:px-8">
        <p className="text-xs tracking-[0.18em] text-brass uppercase">Aidyl Systems</p>
        <h1 className="mt-2 max-w-3xl font-display text-5xl leading-none md:text-6xl">The book is being watched.</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Aether reads the live Carshipy book every minute, including when this tab is closed. Maya reads a lead or a call. Randolph reads a shipment or a logistics change. You are notified. Nothing is written until you approve.
        </p>
        <p className="mt-4 max-w-2xl text-muted">
          {run.reading || (!tableWatch.lastCheck && !tableWatch.lastError)
            ? `Aether is reading the book. ${run.label || "Opening the book"}.`
            : commandBrief()}
          {!run.reading && recommendations.some((item) => item.status === "open") ? " Open items are below." : ""}
        </p>
        <p className="mt-3 text-sm">
          <Link to="/campaigns" className="text-brass">
            Campaign proposals
          </Link>
          <span className="text-muted"> sit apart from the live book. Approving one does not publish it.</span>
        </p>
        {tableWatch.lastError ? <p className="mt-3 max-w-2xl text-sm text-clay">{tableWatch.lastError}</p> : null}
        <dl className="mt-6 grid border border-line sm:grid-cols-3">
          <div className="bg-ink px-4 py-5 text-paper">
            <dt className="text-xs text-paper/60">Carshipy leads</dt>
            {leads.isPending ? <dd className="mt-3 h-8 w-16 animate-pulse rounded bg-paper/30" /> : <dd className="mt-2 font-display text-4xl tabular-nums">{leads.data ? leads.data.count : "—"}</dd>}
          </div>
          <div className="border-t border-line bg-surface px-4 py-5 sm:border-t-0 sm:border-l">
            <dt className="text-xs text-muted">Shipments</dt>
            {ships.isPending ? <dd className="mt-3 h-8 w-16 animate-pulse rounded bg-ink/10" /> : <dd className="mt-2 font-display text-4xl tabular-nums">{ships.data ? ships.data.count : "—"}</dd>}
          </div>
          <div className="border-t border-line bg-brass-soft px-4 py-5 sm:border-t-0 sm:border-l">
            <dt className="text-xs text-brass">Numeric pipeline</dt>
            {leads.isPending ? <dd className="mt-3 h-8 w-28 animate-pulse rounded bg-brass/25" /> : <dd className="mt-2 font-display text-2xl leading-tight break-words tabular-nums">{leads.data ? money(pipeline) : "—"}</dd>}
          </div>
        </dl>
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1 text-xs">
          {LIFE.map((step) => (
            <li key={step.label} className="shrink-0 rounded-full border border-line bg-surface px-3 py-2">
              {step.label}
              <span className="ml-2 tabular-nums text-muted">{buckets.get(step.label) ?? 0}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="grid lg:grid-cols-12">
        <section className="px-4 py-6 md:px-8 lg:col-span-7">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-display text-3xl">Waiting on you</h2>
            <Link to="/activity" className="text-sm text-brass">Activity</Link>
          </div>
          <RecommendationList />
        </section>
        <aside className="border-t border-line px-4 py-6 md:px-8 lg:col-span-5 lg:border-t-0 lg:border-l">
          <h2 className="font-display text-3xl">Agents right now</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {beats.length === 0 ? <li className="px-4 py-4 text-sm text-muted">{run.reading ? `Aether is reading. ${run.label}.` : "Aether is taking the first read."}</li> : null}
            {beats.slice(0, 8).map((beat) => (
              <li key={beat.id} className="px-4 py-3">
                <p className="text-xs tracking-[0.14em] text-brass uppercase">{beat.agent} · {beat.phase}</p>
                <p className="mt-1 text-sm">{beat.text}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-8 font-display text-2xl">Modules</h3>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {companies.map((crm) => (
              <li key={crm.slug}>
                <Link to="/crm/$slug" params={{ slug: crm.slug }} className="block px-4 py-3 hover:bg-brass-soft">
                  <span className="block text-sm">{crm.name}</span>
                  <span className="block text-xs text-muted">
                    {crm.live ? "Live Dynamo · Maya" : crm.slug === "betterdealtv"
                      ? `Public media${ig ? ` · Instagram ${ig.followers.toLocaleString()}` : ""}${social?.youtube?.subscribers != null ? ` · YouTube ${social.youtube.subscribers.toLocaleString()}` : ""}${social?.tiktok ? ` · TikTok ${social.tiktok.followers.toLocaleString()}` : ""}`
                      : "Workspace · Randolph"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="grid gap-6 border-t border-line px-4 py-8 md:px-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">Operating boundaries</h2>
          <p className="mt-2 text-sm text-muted">Aether can read. He writes a live row only after you approve an action. These switches only change what he watches.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Toggle on={controls.watchCarshipy} label="Watch Carshipy" set={(watchCarshipy) => setControls({ ...controls, watchCarshipy })} />
            <Toggle on={controls.watchLogistics} label="Watch logistics" set={(watchLogistics) => setControls({ ...controls, watchLogistics })} />
            <Toggle on={controls.watchMedia} label="Watch BetterDealTV" set={(watchMedia) => setControls({ ...controls, watchMedia })} />
            <button onClick={() => void allowNotifications()} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
              Allow browser notifications
            </button>
          </div>
          <p className="mt-4 text-sm text-muted">
            <a href="/Aidyl-Systems.apk" download="Aidyl-Systems.apk" className="text-brass">Download the Android app</a>
            {" · "}
            <Link to="/training" className="text-brass">Train the agents</Link>
            {" · "}
            <Link to="/reports" className="text-brass">Reports</Link>
          </p>
        </div>
        <form onSubmit={onAdd} className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-display text-2xl">Add a module</h2>
          <p className="mt-1 text-sm text-muted">New modules stay in this workspace until they have their own live book. They do not replace Carshipy.</p>
          <label className="mt-3 block text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2" />
          </label>
          <label className="mt-3 block text-sm">
            Focus
            <input value={focus} onChange={(e) => setFocus(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2" />
          </label>
          {error ? <p className="mt-2 text-sm text-clay">{error}</p> : null}
          <button className="mt-3 rounded-full bg-ink px-4 py-2 text-sm text-paper">Add module</button>
        </form>
      </section>
    </main>
  );
}

function Toggle({ on, label, set }: { on: boolean; label: string; set: (on: boolean) => void }) {
  return (
    <button
      onClick={() => set(!on)}
      className={`rounded-full px-4 py-2 text-sm ${on ? "bg-forest text-paper" : "border border-line bg-surface"}`}
      aria-pressed={on}
    >
      {label}
    </button>
  );
}
