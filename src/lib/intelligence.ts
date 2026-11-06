import { createRecord, isLive, readTable, updateRecord } from "@/lib/crm/data";
import type { Row } from "@/lib/crm/schema";
import { scheduleReminder } from "@/lib/reminders";
import { blankActivity, useAidyl, type Decision, type Recommendation, type SuggestedAction } from "@/lib/store";
import type { PublicSocial } from "@/lib/social";
import { cellText, nowIso, uid } from "@/lib/utils";
import { considerCampaigns } from "@/lib/campaign-desk";

const REVIEW_VERSION = 2;
const LIVE = "carshipy";
const QUIET = new Map<string, number>();
let started = false;
let socialAt = 0;
let ticking = false;

type WatchSpec = {
  slug: string;
  table: string;
  pk: string;
  fields: string[];
  control: "watchCarshipy" | "watchLogistics";
};

const WATCH: WatchSpec[] = [
  { slug: LIVE, table: "tbl_leads", pk: "lead_id", fields: ["name", "stage", "budget", "location", "preferredVehicle", "creditStatus"], control: "watchCarshipy" },
  { slug: LIVE, table: "tbl_shipment", pk: "shipment_id", fields: ["shipment_status", "destination_country", "arrival_date", "lead_id"], control: "watchCarshipy" },
  { slug: LIVE, table: "tbl_logistics", pk: "logistics_id", fields: ["logistics_status", "tracking_number", "lead_id"], control: "watchCarshipy" },
  { slug: LIVE, table: "tbl_calls", pk: "call_id", fields: ["Caller", "outcome", "lead_id"], control: "watchCarshipy" },
  { slug: LIVE, table: "tbl_financing", pk: "financing_id", fields: ["partner_name", "interest_rate", "active_status"], control: "watchCarshipy" },
  { slug: LIVE, table: "tbl_ports", pk: "port_id", fields: ["port_name", "city", "country", "active_status"], control: "watchCarshipy" },
  { slug: "associate-logistics", table: "tbl_logistics", pk: "logistics_id", fields: ["logistics_status", "tracking_number", "lead_id"], control: "watchLogistics" },
];

function beat(agent: "aether" | "maya" | "randolph", phase: string, text: string, href?: string) {
  useAidyl.getState().pushBeat({ agent, phase, text, href });
}

function activity(crm: string, action: string, message: string, agent: string) {
  useAidyl.getState().pushActivity(
    blankActivity({ crm, action, message, performedBy: agent, status: "success", agent }),
  );
}

function reading(step: number, total: number, label: string) {
  useAidyl.getState().setAetherRun({ reading: true, step, total, label });
}

function watchTotal() {
  const controls = useAidyl.getState().controls;
  return WATCH.filter((spec) => controls[spec.control]).length + 2;
}

function stepLabel(spec: WatchSpec) {
  if (spec.slug === "associate-logistics") return "Associate Logistics";
  if (spec.table === "tbl_leads") return "Carshipy leads";
  if (spec.table === "tbl_shipment") return "shipments";
  if (spec.table === "tbl_logistics") return "Carshipy logistics";
  if (spec.table === "tbl_calls") return "calls";
  if (spec.table === "tbl_financing") return "financing";
  if (spec.table === "tbl_ports") return "ports";
  return spec.table;
}

function browser(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* inbox still has it */
  }
}

function blank(value: unknown) {
  const text = cellText(value).trim().toLowerCase();
  return text === "" || text === "—" || text === "-" || text === "unknown" || text === "n/a" || text === "null";
}

function leadName(row: Row) {
  return blank(row.name) ? cellText(row.lead_id) || "Unnamed lead" : cellText(row.name);
}

function missingOf(row: Row) {
  const missing: string[] = [];
  if (blank(row.preferredVehicle)) missing.push("vehicle");
  if (blank(row.location)) missing.push("location");
  if (blank(row.budget)) missing.push("budget");
  if (blank(row.phone)) missing.push("phone");
  return missing;
}

function preferenceLine(kind: string) {
  const related = useAidyl.getState().decisions.filter((item) => item.kind === kind);
  if (related.length < 2) return null;
  const tally = { approve: 0, reject: 0, modify: 0, defer: 0 };
  for (const item of related) tally[item.choice] += 1;
  const top = (Object.entries(tally) as [Decision["choice"], number][]).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return null;
  if (top[0] === "approve") {
    return `You have approved ${top[1]} similar follow-ups. This still stands on the current row, not on that habit alone.`;
  }
  if (top[0] === "reject") {
    return `You have turned down ${top[1]} similar recommendations. I am still raising this one because the live row is incomplete.`;
  }
  if (top[0] === "modify") {
    return `You have rewritten ${top[1]} similar recommendations. Read this one against the row before you repeat that edit.`;
  }
  return `You have deferred ${top[1]} similar items. This one is back because the underlying row has not been filled in.`;
}

function openFingerprint(fp: string) {
  return useAidyl.getState().recommendations.some((item) => item.fingerprint === fp && (item.status === "open" || item.status === "deferred"));
}

function pushRecommendation(rec: Omit<Recommendation, "id" | "at" | "status">) {
  if (openFingerprint(rec.fingerprint)) return;
  const full: Recommendation = { ...rec, id: uid("rec"), at: nowIso(), status: "open" };
  useAidyl.getState().addRecommendation(full);
  const memory = preferenceLine(full.kind);
  const body = memory ? `${full.summary} ${memory}` : full.summary;
  useAidyl.getState().pushNotice({
    title: full.title,
    body,
    href: "/",
    kind: full.priority === "urgent" || full.priority === "warning" ? "warning" : "recommend",
    recommendationId: full.id,
  });
  browser(full.title, body);
  const line = `${full.summary} Suggested: ${full.suggestion} You can approve, reject, modify, or defer it from Command.`;
  const message = {
    id: uid("msg"),
    role: "agent" as const,
    agent: full.analyst === "maya" ? "Maya" : "Randolph",
    text: line,
    at: nowIso(),
  };
  useAidyl.getState().pushMessage(full.analyst === "maya" ? "maya" : "randolph", message);
  if (full.analyst === "maya") {
    useAidyl.getState().pushMessage("randolph", {
      ...message,
      id: uid("msg"),
      agent: "Randolph",
      text: `Maya has a Carshipy recommendation waiting: ${full.title}. ${full.suggestion}`,
    });
  }
  activity(full.module, "recommend", `${full.title}. ${full.suggestion}`, full.analyst === "maya" ? "Maya" : "Randolph");
  beat(full.analyst === "maya" ? "maya" : "randolph", "waiting", `Waiting on you: ${full.title}`, "/");
}

function gapRecommendation(row: Row, social: PublicSocial | null): Omit<Recommendation, "id" | "at" | "status"> | null {
  const missing = missingOf(row);
  const stage = cellText(row.stage) || "unset";
  const late = /deposit|book|sourc|transit/i.test(stage);
  if (missing.length < (late ? 1 : 2)) return null;
  const name = leadName(row);
  const id = cellText(row.lead_id);
  const known = [
    blank(row.preferredVehicle) ? "No vehicle is stored." : `Vehicle on the row: ${cellText(row.preferredVehicle)}.`,
    blank(row.budget) ? "No budget is stored." : `Budget on the row: ${cellText(row.budget)}.`,
    blank(row.location) ? "No location is stored." : `Location on the row: ${cellText(row.location)}.`,
    `Stage is ${stage}.`,
  ];
  const cross = crossEvidence(row, social);
  const evidence = [...known, ...cross];
  const urgent = late && missing.length > 0;
  return {
    module: LIVE,
    kind: urgent ? "incomplete_late" : "incomplete_lead",
    priority: urgent ? "warning" : "recommend",
    title: urgent ? `${name} is late in the book with gaps` : `${name} still needs a real brief`,
    summary: urgent
      ? `Aether saw ${name} already at “${stage}”, and Maya will not treat that stage as settled while ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.`
      : `Aether passed ${name} to Maya. The live row is missing ${missing.join(", ")}, so a vehicle, a lender, or a sailing should not be promised yet.`,
    evidence,
    suggestion: `Ask for ${missing.join(", ")} before the next stage change.`,
    actions: [
      { id: "log_followup", label: "File the follow-up", detail: "Aether writes a workflow log on this lead. He does not invent the missing fields." },
      { id: "remind", label: "Remind me tomorrow", detail: "A reminder for 9:00 tomorrow. No table write." },
    ],
    href: "/crm/carshipy/leads",
    recordId: id,
    fingerprint: `gap:${id}:${missing.join(",")}:${stage}`,
    analyst: "maya",
  };
}

function crossEvidence(row: Row, social: PublicSocial | null) {
  if (!social) return [];
  const hay = `${cellText(row.location)} ${cellText(row.preferredVehicle)}`.toLowerCase();
  const titles = [
    ...(social.youtube?.latest.map((video) => video.title) ?? []),
  ];
  const hit = titles.find((title) => {
    const t = title.toLowerCase();
    if (hay.includes("nigeria") && t.includes("nigeria")) return true;
    if (hay.includes("ghana") && t.includes("ghana")) return true;
    const vehicle = cellText(row.preferredVehicle).toLowerCase();
    const token = vehicle.split(/\s+/).find((word) => word.length > 3);
    return Boolean(token && t.includes(token));
  });
  if (!hit) return [];
  return [`BetterDealTV’s public YouTube feed currently includes “${hit}”, which overlaps this lead. That is a content overlap, not proof of demand.`];
}

function changeRecommendation(spec: WatchSpec, kind: "new" | "update", id: string, next: string, prev: string | undefined, row: Row | undefined): Omit<Recommendation, "id" | "at" | "status"> | null {
  if (spec.table === "tbl_leads" && row && kind === "new") {
    const gap = gapRecommendation(row, useAidyl.getState().socialWatch.snapshot);
    if (gap) {
      return { ...gap, fingerprint: `new:${spec.table}:${id}`, title: `New Carshipy lead: ${leadName(row)}`, kind: "new_lead" };
    }
    return {
      module: LIVE,
      kind: "new_lead",
      priority: "recommend",
      title: `New Carshipy lead: ${leadName(row)}`,
      summary: `Aether detected a new lead and Maya read it. The core brief is present, so the next useful step is a human qualification call rather than another form field.`,
      evidence: [`Stage ${cellText(row.stage) || "unset"}.`, `Vehicle ${cellText(row.preferredVehicle) || "not set"}.`, `Location ${cellText(row.location) || "not set"}.`],
      suggestion: "Qualify the lead before anyone requests a deposit.",
      actions: [
        { id: "log_followup", label: "File the follow-up", detail: "Aether logs that you accepted qualification as the next step." },
        { id: "remind", label: "Remind me tomorrow", detail: "A reminder only." },
      ],
      href: "/crm/carshipy/leads",
      recordId: id,
      fingerprint: `new:${spec.table}:${id}`,
      analyst: "maya",
    };
  }
  if (spec.table === "tbl_leads" && kind === "update") {
    return {
      module: LIVE,
      kind: "lead_update",
      priority: "recommend",
      title: `Carshipy lead changed: ${id}`,
      summary: `Aether saw a meaningful change on ${id}. Maya wants you to confirm the new stage and commercial fields before the rest of the book treats them as settled.`,
      evidence: [`Previously: ${prev || "empty"}.`, `Now: ${next}.`],
      suggestion: "Review the changed fields and either accept them or send the lead back for the missing piece.",
      actions: [{ id: "log_followup", label: "File that you reviewed it", detail: "Aether writes a review note. He does not overwrite the lead." }],
      href: "/crm/carshipy/leads",
      recordId: id,
      fingerprint: `upd:${spec.table}:${id}:${next}`,
      analyst: "maya",
    };
  }
  if (spec.table === "tbl_shipment" || spec.table === "tbl_logistics") {
    const where = spec.slug === LIVE ? "Carshipy" : "Associate Logistics USA";
    return {
      module: spec.slug,
      kind: kind === "new" ? "new_movement" : "movement_update",
      priority: /delay|hold|cancel|stuck/i.test(next) ? "warning" : "info",
      title: `${where} ${kind === "new" ? "new" : "updated"} ${spec.table === "tbl_shipment" ? "shipment" : "logistics"} ${id}`,
      summary: `Aether detected a ${spec.table === "tbl_shipment" ? "shipment" : "logistics"} change. Randolph is treating it as an operational fact, not a recommendation to move money.`,
      evidence: [kind === "update" ? `Was: ${prev}.` : "This record was not on the last check.", `Now: ${next}.`],
      suggestion: "Confirm the milestone with the desk that owns the leg before promising a buyer a date.",
      actions: [
        { id: "log_followup", label: "File the check", detail: "Aether writes a workflow note on the linked lead when this is the live book." },
        { id: "acknowledge", label: "Noted", detail: "Records the decision only." },
      ],
      href: spec.slug === LIVE ? "/crm/carshipy/shipments" : "/crm/associate-logistics/logistics",
      recordId: cellText(row?.lead_id) || id,
      fingerprint: `${kind}:${spec.slug}:${spec.table}:${id}:${next}`,
      analyst: "randolph",
    };
  }
  if (spec.table === "tbl_calls" && kind === "new") {
    return {
      module: LIVE,
      kind: "new_call",
      priority: "info",
      title: `New Carshipy call ${id}`,
      summary: `Aether saw a new call record. Maya is not turning it into a stage change unless you say so.`,
      evidence: [`Caller ${cellText(row?.Caller) || "not named"}.`, `Outcome ${cellText(row?.outcome) || "not written"}.`],
      suggestion: "Read the outcome and decide whether the lead stage should move.",
      actions: [{ id: "acknowledge", label: "Noted", detail: "No table write." }],
      href: "/crm/carshipy/calls",
      recordId: cellText(row?.lead_id) || id,
      fingerprint: `new:${spec.table}:${id}`,
      analyst: "maya",
    };
  }
  if (spec.table === "tbl_financing" || spec.table === "tbl_ports") {
    const noun = spec.table === "tbl_financing" ? "financing partner" : "port";
    const analyst = spec.table === "tbl_financing" ? "maya" : "randolph";
    return {
      module: LIVE,
      kind: kind === "new" ? "new_reference" : "reference_update",
      priority: "info",
      title: `Carshipy ${kind === "new" ? "new" : "updated"} ${noun} ${id}`,
      summary:
        analyst === "maya"
          ? "Aether saw a financing change. Maya will not offer that partner to a buyer until you have looked at the rate and the status."
          : "Aether saw a port change. Randolph will not treat a sailing as confirmed off this row alone.",
      evidence: [kind === "update" ? `Was: ${prev}.` : "This record was not on the last check.", `Now: ${next}.`],
      suggestion: analyst === "maya" ? "Confirm the partner is still one you would offer." : "Confirm the terminal before a date is promised.",
      actions: [{ id: "acknowledge", label: "Noted", detail: "Records the decision only. No table write." }],
      href: spec.table === "tbl_financing" ? "/crm/carshipy/financing" : "/crm/carshipy/ports",
      recordId: id,
      fingerprint: `${kind}:${LIVE}:${spec.table}:${id}:${next}`,
      analyst,
    };
  }
  return null;
}

function contentRecommendation(social: PublicSocial, leads: Row[], videoId: string) {
  const video = social.youtube?.latest.find((item) => item.id === videoId);
  if (!video) return;
  const subs = social.youtube?.subscribers;
  const count = social.youtube?.videos;
  const overlap = leads.filter((row) => crossEvidence(row, social).length > 0).slice(0, 3);
  const evidence = [
    subs != null ? `Public header: ${subs.toLocaleString()} subscribers.` : "Subscriber count was not on the public page.",
    count != null ? `Public header: ${count.toLocaleString()} videos.` : "Video count was not on the public page.",
    "The public feed does not include view counts, so this is not a reach score.",
    overlap.length
      ? `Overlaps ${overlap.length} Carshipy lead${overlap.length === 1 ? "" : "s"} by place or vehicle name: ${overlap.map(leadName).join(", ")}.`
      : "No Carshipy lead currently shares a clear place or vehicle token with this title.",
  ];
  pushRecommendation({
    module: "betterdealtv",
    kind: "new_video",
    priority: "recommend",
    title: `New BetterDealTV video: ${video.title}`,
    summary: `Aether saw a video id that was not on the last public feed. Randolph is not calling it a hit or a miss — only that the catalog changed, and that the title is the evidence.`,
    evidence,
    suggestion: overlap.length
      ? "Review whether this topic should change what Carshipy asks the overlapping leads, without treating one video as demand."
      : "Keep it on the media desk. Do not retune Carshipy off a single public title.",
    actions: [{ id: "acknowledge", label: "Noted", detail: "Records that you saw the content event. No table write." }],
    href: "/crm/betterdealtv/youtube",
    fingerprint: `yt:${video.id}`,
    analyst: "randolph",
  });
}

function collectPrints(spec: WatchSpec, rows: Row[]) {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const id = cellText(row[spec.pk]);
    if (!id) continue;
    out[`${spec.slug}:${spec.table}:${id}`] = spec.fields.map((field) => cellText(row[field])).join(" · ");
  }
  return out;
}

async function scan() {
  const state = useAidyl.getState();
  const controls = state.controls;
  const nextPrints: Record<string, string> = { ...state.tableWatch.prints };
  const events: { spec: WatchSpec; kind: "new" | "update"; id: string; next: string; prev?: string; row?: Row }[] = [];
  let leads: Row[] = [];
  let failed = "";
  const specs = WATCH.filter((spec) => controls[spec.control]);
  const total = specs.length + 2;
  let step = 1;
  for (const spec of specs) {
    step += 1;
    reading(step, total, `Reading ${stepLabel(spec)}`);
    try {
      const rows = await readTable(spec.slug, spec.table);
      if (spec.table === "tbl_leads" && spec.slug === LIVE) leads = rows;
      const prints = collectPrints(spec, rows);
      const prefix = `${spec.slug}:${spec.table}:`;
      if (state.tableWatch.primed) {
        for (const [key, value] of Object.entries(prints)) {
          const prev = state.tableWatch.prints[key];
          const quiet = QUIET.get(key) ?? 0;
          if (prev === value) continue;
          if (quiet > Date.now()) {
            beat("aether", "completed", `Confirmed our own write on ${key.split(":").pop()}.`);
            continue;
          }
          const id = key.slice(prefix.length);
          const row = rows.find((item) => cellText(item[spec.pk]) === id);
          events.push({ spec, kind: prev == null ? "new" : "update", id, next: value, prev, row });
        }
      }
      for (const key of Object.keys(nextPrints)) {
        if (key.startsWith(prefix) && !(key in prints)) delete nextPrints[key];
      }
      Object.assign(nextPrints, prints);
    } catch (error) {
      failed = error instanceof Error ? error.message : "The live book did not answer.";
    }
  }
  useAidyl.getState().setTableWatch({
    primed: true,
    reviewed: state.tableWatch.reviewed,
    prints: nextPrints,
    lastCheck: nowIso(),
    lastError: failed,
    reviewVersion: state.tableWatch.reviewVersion,
  });
  reading(total, total, "Reviewing open gaps");
  if (!state.tableWatch.primed) {
    beat("aether", "detected", failed ? `Could not finish the first read. ${failed}` : "First read of the live book is stored. Existing rows were not announced.");
    if (!failed && controls.watchCarshipy) reviewGaps(leads, useAidyl.getState().socialWatch.snapshot);
    return;
  }
  if (failed) beat("aether", "failed", `Background read failed. ${failed}`);
  let raised = 0;
  for (const event of events) {
    if (raised >= 3) break;
    beat("aether", "detected", `${event.kind === "new" ? "New" : "Changed"} ${event.spec.table} ${event.id}.`);
    beat("maya", "analyzing", `Reading ${event.id} before anyone is notified.`);
    const draft = changeRecommendation(event.spec, event.kind, event.id, event.next, event.prev, event.row);
    if (!draft) continue;
    pushRecommendation(draft);
    raised += 1;
  }
  const stale = (state.tableWatch.reviewVersion ?? 0) < REVIEW_VERSION;
  if ((!state.tableWatch.reviewed || stale) && controls.watchCarshipy) reviewGaps(leads, useAidyl.getState().socialWatch.snapshot);
}

function reviewGaps(leads: Row[], social: PublicSocial | null) {
  const ranked = leads
    .map((row) => ({ row, missing: missingOf(row), stage: cellText(row.stage) }))
    .map((item) => ({
      ...item,
      score: item.missing.length + (/deposit|book|sourc/i.test(item.stage) ? 3 : 0),
    }))
    .filter((item) => item.score >= 2 && item.missing.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  beat("aether", "detected", ranked.length ? `Open-book review found ${ranked.length} Carshipy lead${ranked.length === 1 ? "" : "s"} with gaps.` : "Open-book review found no Carshipy lead that needs a new recommendation.");
  for (const item of ranked) {
    beat("maya", "analyzing", `Reading ${leadName(item.row)}.`);
    const draft = gapRecommendation(item.row, social);
    if (draft) pushRecommendation(draft);
  }
  const watch = useAidyl.getState().tableWatch;
  useAidyl.getState().setTableWatch({ ...watch, reviewed: true, reviewVersion: REVIEW_VERSION });
  beat("randolph", "recommended", "Carshipy gaps are on Command if Maya raised any. Nothing was written.");
}

export async function pullPublicSocial(force = false) {
  if (!force && !useAidyl.getState().controls.watchMedia) return;
  if (!force && Date.now() - socialAt < 180_000 && useAidyl.getState().socialWatch.snapshot) return;
  socialAt = Date.now();
  try {
    const res = await fetch("/api/social");
    const json = (await res.json()) as PublicSocial & { error?: string };
    if (!res.ok || json.error) {
      useAidyl.getState().setSocialWatch({ ...useAidyl.getState().socialWatch, error: json.error || "Public pages did not answer." });
      return;
    }
    const prev = useAidyl.getState().socialWatch;
    const ids = json.youtube?.latest.map((video) => video.id) ?? [];
    useAidyl.getState().setSocialWatch({ primed: true, videoIds: ids, snapshot: json, error: null });
    if (!prev.primed) {
      beat("aether", "detected", "Public BetterDealTV pages are on file. Existing videos were not announced.");
      return;
    }
    const fresh = ids.filter((id) => !prev.videoIds.includes(id));
    let leads: Row[] = [];
    try {
      leads = await readTable(LIVE, "tbl_leads");
    } catch {
      leads = [];
    }
    for (const id of fresh.slice(0, 2)) contentRecommendation(json, leads, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public pages did not answer.";
    useAidyl.getState().setSocialWatch({ ...useAidyl.getState().socialWatch, error: message });
  }
}

export function startIntelligence() {
  if (started || typeof window === "undefined") return;
  started = true;
  let pass = 0;
  const run = async () => {
    if (ticking) return;
    if (document.visibilityState === "hidden") return;
    ticking = true;
    const mine = ++pass;
    const startedAt = Date.now();
    const total = watchTotal();
    try {
      reading(0, total, "Opening the book");
      reading(1, total, "Public pages");
      await pullPublicSocial();
      if (pass !== mine) return;
      await scan();
      if (pass === mine && useAidyl.getState().tableWatch.primed) {
        await considerCampaigns().catch(() => undefined);
      }
    } finally {
      ticking = false;
      const hold = Math.max(0, 900 - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (pass !== mine) return;
        const current = useAidyl.getState().aetherRun;
        useAidyl.getState().setAetherRun({ reading: false, step: current.total, total: current.total, label: "Read complete" });
      }, hold);
    }
  };
  void run();
  window.setInterval(() => void run(), 45_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void run();
  });
}

function tomorrowNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export async function applyDecision(id: string, choice: Decision["choice"], opts?: { actionId?: SuggestedAction["id"]; note?: string }) {
  const rec = useAidyl.getState().recommendations.find((item) => item.id === id);
  if (!rec || (rec.status !== "open" && rec.status !== "deferred" && rec.status !== "modified")) {
    return "That recommendation is no longer waiting.";
  }
  const operator = useAidyl.getState().operatorName || "Admin";
  const note = opts?.note?.trim() ?? "";
  if (choice === "modify" && note.length < 3) return "Tell me what to change, in a sentence.";
  const action = rec.actions.find((item) => item.id === opts?.actionId) ?? rec.actions[0];
  let outcome = "";
  let status: Recommendation["status"] = choice === "approve" ? "approved" : choice === "reject" ? "rejected" : choice === "defer" ? "deferred" : "modified";
  if (choice === "approve" && action) {
    try {
      if (action.id === "log_followup") {
        const leadId = rec.recordId || "aidyl-system";
        if (isLive(rec.module) || rec.module === LIVE) {
          await createRecord({
            slug: LIVE,
            table: "tbl_workflow_logs",
            agent: "Aether",
            values: {
              lead_id: leadId,
              action: "admin_followup",
              status: "approved",
              workflowName: "Maya recommendation",
              message: note || rec.suggestion,
              details: rec.title,
              performed_by: `${operator} via Aether`,
            },
          });
          QUIET.set(`${LIVE}:tbl_workflow_logs:${leadId}`, Date.now() + 120_000);
        }
        outcome = "Aether filed the follow-up on the workflow log. He did not fill in missing lead fields.";
      } else if (action.id === "set_stage" && action.stage && rec.recordId) {
        await updateRecord({
          slug: LIVE,
          table: "tbl_leads",
          key: { lead_id: rec.recordId },
          patch: { stage: action.stage },
          agent: "Aether",
        });
        QUIET.set(`${LIVE}:tbl_leads:${rec.recordId}`, Date.now() + 120_000);
        outcome = `Aether set the stage to ${action.stage}.`;
      } else if (action.id === "remind") {
        await scheduleReminder({
          title: rec.title,
          note: note || rec.suggestion,
          fireAt: tomorrowNine(),
          createdBy: "Maya",
        });
        outcome = "I set a reminder for tomorrow at 9:00. No table was changed.";
      } else {
        outcome = "Recorded. No table was changed.";
      }
      status = "done";
    } catch (error) {
      status = "failed";
      outcome = error instanceof Error ? error.message : "Aether could not complete the write.";
    }
  } else if (choice === "reject") {
    outcome = "Rejected. Nothing was written, and I’ll remember that you turned this kind of recommendation down.";
  } else if (choice === "defer") {
    outcome = "Deferred. It stays on the list and nothing was written.";
  } else {
    outcome = `Modified note saved: ${note}. Nothing was written until you approve an action.`;
  }
  useAidyl.getState().setRecommendationStatus(id, status, note);
  useAidyl.getState().addDecision({ recommendationId: id, kind: rec.kind, choice, note: note || outcome, by: operator });
  activity(rec.module, choice, `${operator} ${choice} “${rec.title}”. ${outcome}`, "Aether");
  beat(choice === "approve" ? "aether" : "randolph", choice, outcome, rec.href);
  return outcome;
}

export function commandBrief() {
  const state = useAidyl.getState();
  if (state.aetherRun.reading) {
    return `Aether is reading the book. ${state.aetherRun.label}.`;
  }
  const open = state.recommendations.filter((item) => item.status === "open" || item.status === "deferred");
  const last = state.beats[0];
  const checked = state.tableWatch.lastCheck ? `Aether last read the book ${new Date(state.tableWatch.lastCheck).toLocaleTimeString()}.` : "Aether has not finished a read yet.";
  const waiting = state.campaigns.filter((item) => item.status === "proposed" || item.status === "revision" || item.status === "deferred");
  const campaignLine = waiting.length ? ` ${waiting.length} campaign proposal${waiting.length === 1 ? "" : "s"} on Campaigns.` : "";
  if (!open.length) return `${checked} Nothing is waiting on you.${campaignLine} ${last ? last.text : ""}`.trim();
  return `${checked} ${open.length} recommendation${open.length === 1 ? "" : "s"} waiting. The first is “${open[0].title}”.${campaignLine}`;
}

export async function answerOperations(text: string): Promise<string | null> {
  const lower = text.toLowerCase();
  const state = useAidyl.getState();
  if (/\b(approve|accept|do it|file it)\b/.test(lower) && /\b(recommend|follow-?up|that|this|maya)\b/.test(lower)) {
    const open = state.recommendations.find((item) => item.status === "open" || item.status === "deferred");
    if (!open) return "Nothing is waiting for approval.";
    const action = /remind/.test(lower) ? "remind" : open.actions[0]?.id;
    return applyDecision(open.id, "approve", { actionId: action });
  }
  if (/^(reject|decline|no)\b/.test(lower) && /recommend|that|this/.test(lower)) {
    const open = state.recommendations.find((item) => item.status === "open");
    if (!open) return "There isn’t an open recommendation to reject.";
    return applyDecision(open.id, "reject");
  }
  if (/^defer\b/.test(lower)) {
    const open = state.recommendations.find((item) => item.status === "open");
    if (!open) return "Nothing open to defer.";
    return applyDecision(open.id, "defer");
  }
  const modify = text.match(/^modify(?:\s+that)?\s*[:\-]?\s+(.{3,})$/i);
  if (modify) {
    const open = state.recommendations.find((item) => item.status === "open" || item.status === "modified");
    if (!open) return "Nothing open to modify.";
    return applyDecision(open.id, "modify", { note: modify[1] });
  }
  if (/\b(what changed|while i was away|what did i miss)\b/.test(lower)) {
    const beats = state.beats.slice(0, 4).map((item) => item.text);
    const open = state.recommendations.filter((item) => item.status === "open");
    return `${commandBrief()} ${beats.length ? `Latest agent notes: ${beats.join(" ")}` : ""} ${open.length ? `Open: ${open.map((item) => item.title).join("; ")}.` : ""}`.trim();
  }
  if (/\b(what needs my attention|waiting for me|pending decisions|what should i review)\b/.test(lower)) {
    const open = state.recommendations.filter((item) => item.status === "open" || item.status === "deferred");
    if (!open.length) return "Nothing is waiting on a decision. Aether is still watching the live book.";
    return open
      .slice(0, 4)
      .map((item) => `${item.title}. ${item.suggestion} Evidence: ${item.evidence.slice(0, 2).join(" ")}`)
      .join(" ");
  }
  if (/\b(what are the agents|what are you working|agent activity)\b/.test(lower)) {
    const beats = state.beats.slice(0, 5);
    if (!beats.length) return "We just came on watch. Aether reads Carshipy in the background, Maya interprets those changes, and I keep the cross-module view.";
    return beats.map((item) => `${item.agent}: ${item.text}`).join(" ");
  }
  if (/\b(why (this|that|the) recommendation|show me the evidence|why did you recommend)\b/.test(lower)) {
    const rec = state.recommendations.find((item) => item.status === "open") ?? state.recommendations[0];
    if (!rec) return "There isn’t a recommendation on the desk yet.";
    return `${rec.title}. ${rec.summary} Evidence: ${rec.evidence.join(" ")} This is an interpretation of those facts, not a new fact.`;
  }
  if (/\b(biggest risk|what are the risks)\b/.test(lower)) {
    const risks = state.recommendations.filter((item) => item.priority === "warning" || item.priority === "urgent");
    if (!risks.length) return "No warning is open. The live risks I look for are late-stage Carshipy leads missing a vehicle, a location, or a budget, and shipments whose status changed.";
    return risks.slice(0, 3).map((item) => item.summary).join(" ");
  }
  if (/\b(biggest opportunit|what are the opportunit)\b/.test(lower)) {
    const social = state.socialWatch.snapshot;
    const latest = social?.youtube?.latest[0];
    return latest
      ? `The newest public BetterDealTV video is “${latest.title}”. I will only call it an opportunity for Carshipy when a live lead shares a place or a vehicle with that title. Private reach is not available.`
      : "I don’t have a fresh public video title yet, so I won’t invent an opportunity.";
  }
  return null;
}
