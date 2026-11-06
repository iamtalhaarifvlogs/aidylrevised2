import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { Recommendation } from "@/lib/store";
import { fromItem, mergeCampaigns, proposeCampaigns, toItem, type Campaign } from "@/lib/campaigns";

const require = createRequire(import.meta.url);
const webpush = require("web-push") as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  generateVAPIDKeys: () => { publicKey: string; privateKey: string };
  sendNotification: (sub: PushSub, payload: string) => Promise<unknown>;
};

const API = "https://mbz2lmd7ud.execute-api.us-east-2.amazonaws.com/default/crm_data";
const DIR = path.join(process.cwd(), "data", "aether");
const INTERVAL_MS = 60_000;
const AWAKE_MS = 45_000;
const LIVE = "carshipy";

type Row = Record<string, unknown>;
type PushSub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };
type Reminder = { id: string; title: string; note: string; fireAt: string; createdBy: string; fired?: boolean };

export type AetherPacket = {
  id: string;
  at: string;
  notice: { title: string; body: string; href?: string; kind?: "info" | "recommend" | "warning" | "urgent" | "system" };
  recommendation?: Recommendation;
  campaign?: Campaign;
  beat?: { agent: "aether" | "maya" | "randolph"; phase: string; text: string; href?: string };
  firedReminderId?: string;
};

type WatchState = {
  primed: boolean;
  reviewed: boolean;
  prints: Record<string, string>;
  lastCheck: string;
  lastError: string;
};

const SPECS = [
  { table: "tbl_leads", pk: "lead_id", fields: ["name", "stage", "budget", "location", "preferredVehicle", "creditStatus"], label: "lead" },
  { table: "tbl_shipment", pk: "shipment_id", fields: ["shipment_status", "destination_country", "arrival_date", "lead_id"], label: "shipment" },
  { table: "tbl_logistics", pk: "logistics_id", fields: ["logistics_status", "tracking_number", "lead_id"], label: "logistics" },
  { table: "tbl_calls", pk: "call_id", fields: ["Caller", "outcome", "lead_id"], label: "call" },
  { table: "tbl_financing", pk: "financing_id", fields: ["partner_name", "interest_rate", "active_status"], label: "financing partner" },
  { table: "tbl_ports", pk: "port_id", fields: ["port_name", "city", "country", "active_status"], label: "port" },
] as const;

type Vapid = { publicKey: string; privateKey: string };

let started = false;
let ticking = false;
let lastAwake = 0;
let vapid: Vapid | null = null;

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cell(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function blank(value: unknown) {
  const text = cell(value).trim().toLowerCase();
  return text === "" || text === "—" || text === "-" || text === "unknown" || text === "n/a" || text === "null";
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(DIR, name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(name: string, value: unknown) {
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), JSON.stringify(value), "utf8");
}

async function keys() {
  if (vapid) return vapid;
  const stored = await readJson<Vapid | null>("vapid.json", null);
  if (stored?.publicKey && stored.privateKey) {
    vapid = stored;
  } else {
    vapid = webpush.generateVAPIDKeys();
    await writeJson("vapid.json", vapid);
  }
  webpush.setVapidDetails("mailto:desk@aidyl.systems", vapid.publicKey, vapid.privateKey);
  return vapid;
}

async function listTable(table: string): Promise<Row[]> {
  const res = await fetch(`${API}?TableName=${encodeURIComponent(table)}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 180) || `Gateway ${res.status}`);
  const json = JSON.parse(text) as { Items?: Row[] };
  return Array.isArray(json.Items) ? json.Items : [];
}

function printOf(row: Row, fields: readonly string[]) {
  return fields.map((field) => cell(row[field])).join(" · ");
}

function leadName(row: Row) {
  return blank(row.name) ? cell(row.lead_id) || "Unnamed lead" : cell(row.name);
}

function missingOf(row: Row) {
  const missing: string[] = [];
  if (blank(row.preferredVehicle)) missing.push("vehicle");
  if (blank(row.location)) missing.push("location");
  if (blank(row.budget)) missing.push("budget");
  if (blank(row.phone)) missing.push("phone");
  return missing;
}

function gapRecommendation(row: Row): Recommendation | null {
  const missing = missingOf(row);
  const stage = cell(row.stage) || "unset";
  const late = /deposit|book|sourc|transit/i.test(stage);
  if (missing.length < (late ? 1 : 2)) return null;
  const name = leadName(row);
  const id = cell(row.lead_id);
  const urgent = late && missing.length > 0;
  return {
    id: uid("rec"),
    at: nowIso(),
    module: LIVE,
    kind: urgent ? "incomplete_late" : "incomplete_lead",
    priority: urgent ? "warning" : "recommend",
    title: urgent ? `${name} is late in the book with gaps` : `${name} still needs a real brief`,
    summary: urgent
      ? `Aether saw ${name} already at “${stage}”, and Maya will not treat that stage as settled while ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing.`
      : `Aether passed ${name} to Maya. The live row is missing ${missing.join(", ")}, so a vehicle, a lender, or a sailing should not be promised yet.`,
    evidence: [`Stage is ${stage}.`, `Missing: ${missing.join(", ")}.`],
    suggestion: `Ask for ${missing.join(", ")} before the next stage change.`,
    actions: [
      { id: "log_followup", label: "File the follow-up", detail: "Aether writes a workflow log on this lead. He does not invent the missing fields." },
      { id: "remind", label: "Remind me tomorrow", detail: "A reminder for 9:00 tomorrow. No table write." },
    ],
    href: "/crm/carshipy/leads",
    recordId: id,
    fingerprint: `gap:${id}:${missing.join(",")}:${stage}`,
    analyst: "maya",
    status: "open",
  };
}

function changeRecommendation(table: string, kind: "new" | "update", id: string, next: string, prev: string | undefined, row: Row | undefined): Recommendation | null {
  if (table === "tbl_leads" && row && kind === "new") {
    const gap = gapRecommendation(row);
    if (gap) return { ...gap, fingerprint: `new:${table}:${id}`, title: `New Carshipy lead: ${leadName(row)}`, kind: "new_lead" };
    return {
      id: uid("rec"),
      at: nowIso(),
      module: LIVE,
      kind: "new_lead",
      priority: "recommend",
      title: `New Carshipy lead: ${leadName(row)}`,
      summary: "Aether detected a new lead and Maya read it. The core brief is present, so the next useful step is a human qualification call.",
      evidence: [`Stage ${cell(row.stage) || "unset"}.`, `Vehicle ${cell(row.preferredVehicle) || "not set"}.`, `Location ${cell(row.location) || "not set"}.`],
      suggestion: "Qualify the lead before anyone requests a deposit.",
      actions: [
        { id: "log_followup", label: "File the follow-up", detail: "Aether logs that you accepted qualification as the next step." },
        { id: "remind", label: "Remind me tomorrow", detail: "A reminder only." },
      ],
      href: "/crm/carshipy/leads",
      recordId: id,
      fingerprint: `new:${table}:${id}`,
      analyst: "maya",
      status: "open",
    };
  }
  if (table === "tbl_leads" && kind === "update") {
    return {
      id: uid("rec"),
      at: nowIso(),
      module: LIVE,
      kind: "lead_update",
      priority: "recommend",
      title: `Carshipy lead changed: ${id}`,
      summary: `Aether saw a meaningful change on ${id}. Maya wants you to confirm the new stage and commercial fields before the rest of the book treats them as settled.`,
      evidence: [`Previously: ${prev || "empty"}.`, `Now: ${next}.`],
      suggestion: "Review the changed fields. Nothing is written until you approve.",
      actions: [{ id: "log_followup", label: "File that you reviewed it", detail: "Aether writes a review note. He does not overwrite the lead." }],
      href: "/crm/carshipy/leads",
      recordId: id,
      fingerprint: `upd:${table}:${id}:${next}`,
      analyst: "maya",
      status: "open",
    };
  }
  if (table === "tbl_shipment" || table === "tbl_logistics") {
    const noun = table === "tbl_shipment" ? "shipment" : "logistics";
    return {
      id: uid("rec"),
      at: nowIso(),
      module: LIVE,
      kind: kind === "new" ? "new_movement" : "movement_update",
      priority: /delay|hold|cancel|stuck/i.test(next) ? "warning" : "info",
      title: `Carshipy ${kind === "new" ? "new" : "updated"} ${noun} ${id}`,
      summary: `Aether detected a ${noun} change. Randolph is treating it as an operational fact. He will not move money or rewrite the row unless you approve a note.`,
      evidence: [kind === "update" ? `Was: ${prev}.` : "This record was not on the last check.", `Now: ${next}.`],
      suggestion: "Confirm the milestone before promising a buyer a date.",
      actions: [
        { id: "log_followup", label: "File the check", detail: "Aether writes a workflow note. He does not change the shipment itself." },
        { id: "acknowledge", label: "Noted", detail: "Records the decision only." },
      ],
      href: table === "tbl_shipment" ? "/crm/carshipy/shipments" : "/crm/carshipy/logistics",
      recordId: cell(row?.lead_id) || id,
      fingerprint: `${kind}:${LIVE}:${table}:${id}:${next}`,
      analyst: "randolph",
      status: "open",
    };
  }
  if (table === "tbl_calls" && kind === "new") {
    return {
      id: uid("rec"),
      at: nowIso(),
      module: LIVE,
      kind: "new_call",
      priority: "info",
      title: `New Carshipy call ${id}`,
      summary: "Aether saw a new call record. Maya is not turning it into a stage change unless you say so.",
      evidence: [`Caller ${cell(row?.Caller) || "not named"}.`, `Outcome ${cell(row?.outcome) || "not written"}.`],
      suggestion: "Read the outcome and decide whether the lead stage should move.",
      actions: [{ id: "acknowledge", label: "Noted", detail: "No table write." }],
      href: "/crm/carshipy/calls",
      recordId: cell(row?.lead_id) || id,
      fingerprint: `new:${table}:${id}`,
      analyst: "maya",
      status: "open",
    };
  }
  if (table === "tbl_financing" || table === "tbl_ports") {
    const noun = table === "tbl_financing" ? "financing partner" : "port";
    const analyst = table === "tbl_financing" ? "maya" : "randolph";
    return {
      id: uid("rec"),
      at: nowIso(),
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
      href: table === "tbl_financing" ? "/crm/carshipy/financing" : "/crm/carshipy/ports",
      recordId: id,
      fingerprint: `${kind}:${LIVE}:${table}:${id}:${next}`,
      analyst,
      status: "open",
    };
  }
  return null;
}

async function pushAll(packets: AetherPacket[]) {
  const audible = packets.filter((packet) => packet.notice.kind !== "system");
  if (!audible.length || Date.now() - lastAwake < AWAKE_MS) return;
  const subs = await readJson<PushSub[]>("subs.json", []);
  if (!subs.length) return;
  await keys();
  const kept: PushSub[] = [];
  for (const sub of subs) {
    let dead = false;
    for (const packet of audible.slice(0, 3)) {
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({ title: packet.notice.title, body: packet.notice.body, href: packet.notice.href || "/" }),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead = true;
      }
    }
    if (audible.length > 3) {
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            title: "Aidyl desk",
            body: `Aether found ${audible.length} changes. Open the desk to decide.`,
            href: "/",
          }),
        );
      } catch {
        /* one summary is enough */
      }
    }
    if (!dead) kept.push(sub);
  }
  if (kept.length !== subs.length) await writeJson("subs.json", kept);
}

async function enqueue(packets: AetherPacket[]) {
  if (!packets.length) return;
  const prev = await readJson<AetherPacket[]>("inbox.json", []);
  await writeJson("inbox.json", [...prev, ...packets].slice(-80));
  await pushAll(packets);
}

async function sweepReminders() {
  const reminders = await readJson<Reminder[]>("reminders.json", []);
  const due = reminders.filter((item) => !item.fired && new Date(item.fireAt).getTime() <= Date.now());
  if (!due.length) return;
  const awake = Date.now() - lastAwake < AWAKE_MS;
  const packets: AetherPacket[] = awake
    ? []
    : due.map((item) => ({
        id: `remfire:${item.id}`,
        at: nowIso(),
        firedReminderId: item.id,
        notice: {
          title: item.title,
          body: `${item.note || item.title} · set by ${item.createdBy}`,
          href: "/activity",
          kind: "info" as const,
        },
        beat: { agent: "aether" as const, phase: "notify", text: `Reminder due: ${item.title}`, href: "/activity" },
      }));
  for (const item of reminders) {
    if (due.some((one) => one.id === item.id)) item.fired = true;
  }
  await writeJson("reminders.json", reminders);
  await enqueue(packets);
}

type CampaignMirror = {
  campaigns: Campaign[];
  lastIdeate: string;
  paused: boolean;
  gatewayError: string;
  missingUntil: number;
};

async function readCampaignMirror(): Promise<CampaignMirror> {
  return readJson<CampaignMirror>("campaigns.json", {
    campaigns: [],
    lastIdeate: "",
    paused: false,
    gatewayError: "",
    missingUntil: 0,
  });
}

async function putCampaign(campaign: Campaign) {
  const { synced: _synced, ...rest } = campaign;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ TableName: "tbl_campaigns", Item: toItem(rest) }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, missing: /not found/i.test(text), error: text.slice(0, 180) };
  return { ok: true, missing: false, error: "" };
}

async function ideateCampaigns(changed: boolean) {
  const mirror = await readCampaignMirror();
  const now = Date.now();
  const stale = !mirror.lastIdeate || now - new Date(mirror.lastIdeate).getTime() > 30 * 60_000;
  let campaigns = mirror.campaigns;
  if (now >= mirror.missingUntil) {
    const flushed: Campaign[] = [];
    let missing = false;
    let error = "";
    for (const campaign of campaigns) {
      if (campaign.synced) {
        flushed.push(campaign);
        continue;
      }
      const result = await putCampaign(campaign);
      if (result.missing) {
        missing = true;
        error = result.error;
        flushed.push({ ...campaign, synced: false });
        break;
      }
      flushed.push({ ...campaign, synced: result.ok });
      if (!result.ok) error = result.error;
    }
    const untouched = campaigns.slice(flushed.length);
    campaigns = [...flushed, ...untouched];
    mirror.gatewayError = error;
    if (missing) mirror.missingUntil = now + 30 * 60_000;
  }
  if (!mirror.paused && (changed || stale)) {
    try {
      const [leads, shipments, logistics, financing, ports] = await Promise.all([
        listTable("tbl_leads"),
        listTable("tbl_shipment"),
        listTable("tbl_logistics"),
        listTable("tbl_financing"),
        listTable("tbl_ports"),
      ]);
      let remote: Campaign[] = [];
      if (now >= mirror.missingUntil) {
        try {
          remote = (await listTable("tbl_campaigns")).map(fromItem).filter((item): item is Campaign => Boolean(item));
          mirror.gatewayError = "";
        } catch (error) {
          const message = error instanceof Error ? error.message : "tbl_campaigns did not answer.";
          mirror.gatewayError = message;
          if (/not found/i.test(message)) mirror.missingUntil = now + 30 * 60_000;
        }
      }
      const known = mergeCampaigns(campaigns, remote);
      const fresh = proposeCampaigns({ leads, shipments, logistics, financing, ports, campaigns: known, now: nowIso() });
      const packets: AetherPacket[] = [];
      const saved: Campaign[] = [];
      for (const campaign of fresh) {
        let stored = campaign;
        if (now >= mirror.missingUntil) {
          const result = await putCampaign(campaign);
          stored = { ...campaign, synced: result.ok };
          if (result.missing) {
            mirror.gatewayError = result.error;
            mirror.missingUntil = Date.now() + 30 * 60_000;
          } else if (!result.ok) mirror.gatewayError = result.error;
        }
        saved.push(stored);
        const who = campaign.analyst === "maya" ? "Maya" : "Randolph";
        packets.push({
          id: `campaign:${campaign.cp_id}`,
          at: nowIso(),
          campaign: stored,
          notice: {
            title: `Campaign proposal: ${campaign.title}`,
            body: `${who} prepared this from the live book. It is not published, and nothing is spent until you approve it.`,
            href: "/campaigns",
            kind: "recommend",
          },
          beat: {
            agent: campaign.analyst,
            phase: "recommended",
            text: `${who} filed a campaign proposal. Nothing was published.`,
            href: "/campaigns",
          },
        });
      }
      campaigns = mergeCampaigns(saved, known);
      mirror.lastIdeate = nowIso();
      await enqueue(packets);
    } catch (error) {
      mirror.gatewayError = error instanceof Error ? error.message : "Campaign ideation did not finish.";
    }
  }
  mirror.campaigns = campaigns.slice(0, 40);
  await writeJson("campaigns.json", mirror);
}

async function tick() {
  if (ticking) return;
  ticking = true;
  const watch = await readJson<WatchState>("watch.json", { primed: false, reviewed: false, prints: {}, lastCheck: "", lastError: "" });
  const nextPrints: Record<string, string> = { ...watch.prints };
  const packets: AetherPacket[] = [];
  let failed = "";
  let leads: Row[] = [];
  try {
    for (const spec of SPECS) {
      const rows = await listTable(spec.table);
      if (spec.table === "tbl_leads") leads = rows;
      const prefix = `${spec.table}:`;
      const prints: Record<string, string> = {};
      for (const row of rows) {
        const id = cell(row[spec.pk]);
        if (!id) continue;
        prints[`${prefix}${id}`] = printOf(row, spec.fields);
      }
      if (watch.primed) {
        for (const [key, value] of Object.entries(prints)) {
          const prev = watch.prints[key];
          if (prev === value) continue;
          const id = key.slice(prefix.length);
          const row = rows.find((item) => cell(item[spec.pk]) === id);
          const rec = changeRecommendation(spec.table, prev == null ? "new" : "update", id, value, prev, row);
          if (!rec) continue;
          const analyst = rec.analyst === "maya" ? "maya" : "randolph";
          packets.push({
            id: uid("evt"),
            at: nowIso(),
            notice: {
              title: rec.title,
              body: rec.summary,
              href: rec.href,
              kind: rec.priority === "warning" || rec.priority === "urgent" ? "warning" : "recommend",
            },
            recommendation: rec,
            beat: {
              agent: analyst,
              phase: "recommended",
              text: `${analyst === "maya" ? "Maya" : "Randolph"} read ${spec.label} ${id}. Waiting on you. Nothing was written.`,
              href: rec.href,
            },
          });
          if (packets.length >= 4) break;
        }
      }
      for (const key of Object.keys(nextPrints)) {
        if (key.startsWith(prefix) && !(key in prints)) delete nextPrints[key];
      }
      Object.assign(nextPrints, prints);
      if (packets.length >= 4) break;
    }
    if (!watch.primed && !failed) {
      packets.push({
        id: uid("evt"),
        at: nowIso(),
        notice: {
          title: "Aether has the live book",
          body: "The first read is stored. Existing rows were not announced. New leads, shipments, logistics, and calls will notify you from here, even if the desk is closed.",
          href: "/",
          kind: "system",
        },
        beat: { agent: "aether", phase: "detected", text: "First server read of Carshipy is stored. Existing rows were not announced." },
      });
    }
  if (watch.primed && !watch.reviewed && !failed) {
      const ranked = leads
        .map((row) => ({ row, missing: missingOf(row), stage: cell(row.stage) }))
        .map((item) => ({ ...item, score: item.missing.length + (/deposit|book|sourc/i.test(item.stage) ? 3 : 0) }))
        .filter((item) => item.score >= 2 && item.missing.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
      for (const item of ranked) {
        const rec = gapRecommendation(item.row);
        if (!rec) continue;
        packets.push({
          id: uid("evt"),
          at: nowIso(),
          notice: { title: rec.title, body: rec.summary, href: rec.href, kind: rec.priority === "warning" ? "warning" : "recommend" },
          recommendation: rec,
          beat: { agent: "maya", phase: "recommended", text: `Maya flagged ${leadName(item.row)}. Waiting on you.`, href: rec.href },
        });
      }
    }
  } catch (error) {
    failed = error instanceof Error ? error.message : "The live book did not answer.";
  }
  try {
    await writeJson("watch.json", {
      primed: failed ? watch.primed : true,
      reviewed: failed ? watch.reviewed : watch.primed,
      prints: failed ? watch.prints : nextPrints,
      lastCheck: nowIso(),
      lastError: failed,
    } satisfies WatchState);
    await enqueue(packets.slice(0, 4));
    await sweepReminders();
    if (!failed) await ideateCampaigns(packets.some((item) => item.recommendation?.kind === "new_lead" || item.recommendation?.kind === "new_movement" || item.recommendation?.kind === "movement_update" || item.recommendation?.kind === "lead_update"));
  } finally {
    ticking = false;
  }
}

export function startAetherWatch() {
  if (started) return;
  started = true;
  void keys().catch(() => undefined);
  void tick();
  setInterval(() => void tick(), INTERVAL_MS);
}

export async function handleAetherGet(request: Request) {
  startAetherWatch();
  const url = new URL(request.url);
  const since = url.searchParams.get("since") || "";
  const [key, watch, inbox, mirror] = await Promise.all([
    keys(),
    readJson<WatchState>("watch.json", { primed: false, reviewed: false, prints: {}, lastCheck: "", lastError: "" }),
    readJson<AetherPacket[]>("inbox.json", []),
    readCampaignMirror(),
  ]);
  const events = since ? inbox.filter((item) => item.at > since) : inbox.slice(-20);
  return Response.json({
    publicKey: key.publicKey,
    intervalMs: INTERVAL_MS,
    lastCheck: watch.lastCheck,
    lastError: watch.lastError,
    primed: watch.primed,
    events,
    campaigns: mirror.campaigns,
    campaignGateway: mirror.gatewayError,
  });
}

export async function handleAetherPost(request: Request) {
  startAetherWatch();
  const body = (await request.json().catch(() => null)) as {
    op?: string;
    subscription?: PushSub;
    reminder?: Reminder;
    id?: string;
    paused?: boolean;
  } | null;
  if (!body?.op) return Response.json({ ok: false }, { status: 400 });
  if (body.op === "heartbeat") {
    lastAwake = Date.now();
    return Response.json({ ok: true });
  }
  if (body.op === "subscribe" && body.subscription?.endpoint) {
    const subs = await readJson<PushSub[]>("subs.json", []);
    const next = subs.filter((item) => item.endpoint !== body.subscription!.endpoint);
    next.push(body.subscription);
    await writeJson("subs.json", next.slice(-20));
    return Response.json({ ok: true });
  }
  if (body.op === "reminder" && body.reminder?.id && body.reminder.fireAt) {
    const reminders = await readJson<Reminder[]>("reminders.json", []);
    const rest = reminders.filter((item) => item.id !== body.reminder!.id);
    rest.push({ ...body.reminder, fired: false });
    await writeJson("reminders.json", rest.slice(-40));
    return Response.json({ ok: true });
  }
  if (body.op === "cancel-reminder" && body.id) {
    const reminders = await readJson<Reminder[]>("reminders.json", []);
    await writeJson("reminders.json", reminders.filter((item) => item.id !== body.id));
    return Response.json({ ok: true });
  }
  if (body.op === "campaign-pause") {
    const mirror = await readCampaignMirror();
    mirror.paused = Boolean(body.paused);
    await writeJson("campaigns.json", mirror);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false }, { status: 400 });
}
