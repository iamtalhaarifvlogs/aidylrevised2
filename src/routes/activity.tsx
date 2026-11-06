import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTable } from "@/lib/crm/gateway.functions";
import { cancelReminder, formatWhen, scheduleReminder } from "@/lib/reminders";
import { useAidyl } from "@/lib/store";
import { cellText } from "@/lib/utils";

export const Route = createFileRoute("/activity")({ component: ActivityPage });

function ActivityPage() {
  const local = useAidyl((s) => s.activity);
  const logs = useQuery({
    queryKey: ["crm", "tbl_workflow_logs"],
    queryFn: () => listTable({ data: { table: "tbl_workflow_logs" } }),
  });
  const remote = [...(logs.data?.items ?? [])].sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));

  return (
    <main className="px-4 py-6 md:px-8">
      <h1 className="font-display text-4xl">Activity</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Console actions stay on this desk. Approved writes against Carshipy are also pushed to tbl_workflow_logs. Detections, recommendations, and decisions land here too.
      </p>
      <ReminderBoard />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl">This console</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {local.length === 0 ? <li className="px-4 py-6 text-sm text-muted">No console actions yet.</li> : null}
            {local.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <p className="text-sm">{event.message}</p>
                <p className="text-xs text-muted">
                  {new Date(event.at).toLocaleString()} · {event.performedBy}
                  {event.agent ? ` · ${event.agent}` : ""} · {event.crm}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl">Workflow log</h2>
          {logs.isLoading ? <p className="mt-3 text-sm text-muted">Loading tbl_workflow_logs…</p> : null}
          {logs.error ? <p className="mt-3 text-sm text-clay">Could not load the workflow table.</p> : null}
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {remote.length === 0 && !logs.isLoading ? <li className="px-4 py-6 text-sm text-muted">No workflow rows.</li> : null}
            {remote.map((row, index) => (
              <li key={`${String(row.timestamp)}-${index}`} className="px-4 py-3">
                <p className="text-sm">{cellText(row.message || row.action)}</p>
                <p className="text-xs text-muted">
                  {cellText(row.timestamp)} · {cellText(row.performed_by)} · {cellText(row.workflowName)} · lead {cellText(row.lead_id)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function ReminderBoard() {
  const reminders = useAidyl((s) => s.reminders);
  const notices = useAidyl((s) => s.notices);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("30");
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("minutes");

  function add(fireAt: string) {
    const label = title.trim() || "Desk reminder";
    void scheduleReminder({ title: label, note: label, fireAt, createdBy: "Admin" });
    setTitle("");
  }

  function addDuration() {
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0) return;
    const ms = unit === "minutes" ? count * 60_000 : unit === "hours" ? count * 3_600_000 : count * 86_400_000;
    add(new Date(Date.now() + ms).toISOString());
  }

  function addTomorrow() {
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(9, 0, 0, 0);
    add(when.toISOString());
  }

  const upcoming = reminders.filter((item) => !item.fired);
  const done = reminders.filter((item) => item.fired).slice(0, 6);

  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">Reminders</p>
          <h2 className="font-display text-3xl">Tap me at a time</h2>
        </div>
        <button
          className="rounded-full border border-line px-4 py-2 text-sm"
          onClick={() => {
            if (typeof Notification !== "undefined") void Notification.requestPermission();
          }}
        >
          Allow browser alerts
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">Set one yourself, or tell Maya or Randolph in the chat. Example: “remind me in 2 hours to review BetterdealTV”.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What should I remind you about?" className="min-w-56 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className="w-20 rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as "minutes" | "hours" | "days")} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm">
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper" onClick={addDuration}>Set reminder</button>
        <button className="rounded-full bg-brass px-4 py-2 text-sm text-paper" onClick={addTomorrow}>Tomorrow at 9</button>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {upcoming.length === 0 ? <li className="py-3 text-sm text-muted">No reminders waiting.</li> : null}
        {upcoming.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-3">
            <div>
              <p className="text-sm">{item.title}</p>
              <p className="text-xs text-muted">{formatWhen(item.fireAt)} · {new Date(item.fireAt).toLocaleString()} · {item.createdBy}</p>
            </div>
            <button className="text-sm text-clay" onClick={() => cancelReminder(item.id)}>Cancel</button>
          </li>
        ))}
        {done.map((item) => (
          <li key={item.id} className="py-3 text-sm text-muted">{item.title} · already sent</li>
        ))}
      </ul>
      {notices.length > 0 ? (
        <div className="mt-2">
          <h3 className="font-display text-xl">Recent alerts</h3>
          <ul className="mt-2 space-y-2">
            {notices.slice(0, 5).map((notice) => (
              <li key={notice.id} className="rounded-2xl bg-bg px-3 py-2">
                <p className="text-xs text-brass">{notice.title}</p>
                <p className="text-sm">{notice.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
