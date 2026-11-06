import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { pushNotice } from "./store";
import { ensureDeskChannel } from "./notify";
import { loadWatch, saveWatch, type WatchAlert, type WatchFile } from "./watch-file";

const TASK = "aidyl-book-watch";
const API = "https://mbz2lmd7ud.execute-api.us-east-2.amazonaws.com/default/crm_data";

const SPECS = [
  { table: "tbl_leads", pk: "lead_id", fields: ["name", "stage", "budget", "location", "preferredVehicle"], noun: "lead", who: "Maya", advice: "Qualify it before anyone asks for a deposit. Nothing was written." },
  { table: "tbl_shipment", pk: "shipment_id", fields: ["shipment_status", "destination_country", "arrival_date"], noun: "shipment", who: "Randolph", advice: "Confirm the milestone before promising a date. Nothing was written." },
  { table: "tbl_logistics", pk: "logistics_id", fields: ["logistics_status", "tracking_number"], noun: "logistics record", who: "Randolph", advice: "Treat it as an operational fact until you approve a note." },
  { table: "tbl_calls", pk: "call_id", fields: ["Caller", "outcome"], noun: "call", who: "Maya", advice: "She will not move a stage unless you say so." },
  { table: "tbl_financing", pk: "financing_id", fields: ["partner_name", "interest_rate", "active_status"], noun: "financing partner", who: "Maya", advice: "Read the rate and status before offering it to a buyer." },
  { table: "tbl_ports", pk: "port_id", fields: ["port_name", "city", "country", "active_status"], noun: "port", who: "Randolph", advice: "Confirm the terminal before a sailing is promised." },
] as const;

function cell(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function blank(value: unknown) {
  const text = cell(value).trim().toLowerCase();
  return text === "" || text === "—" || text === "-" || text === "unknown" || text === "n/a" || text === "null";
}

async function listTable(table: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API}?TableName=${encodeURIComponent(table)}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const json = (await res.json()) as { Items?: Record<string, unknown>[] };
  return Array.isArray(json.Items) ? json.Items : [];
}

async function ping(alert: WatchAlert, desk: boolean) {
  if (desk) pushNotice({ title: alert.title, body: alert.body });
  if (Platform.OS === "web") return;
  try {
    await ensureDeskChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.body, sound: true },
      trigger: null,
    });
  } catch {
    /* the desk notice still lands when the app is open */
  }
}

export async function scanBook(desk: boolean) {
  const watch = await loadWatch();
  if (desk && watch.pending.length) {
    for (const alert of watch.pending) pushNotice(alert);
    watch.pending = [];
    await saveWatch(watch);
  }
  const next: Record<string, string> = { ...watch.prints };
  const alerts: WatchAlert[] = [];
  let leads: Record<string, unknown>[] = [];
  for (const spec of SPECS) {
    const rows = await listTable(spec.table);
    if (spec.table === "tbl_leads") leads = rows;
    const prefix = `${spec.table}:`;
    const prints: Record<string, string> = {};
    for (const row of rows) {
      const id = cell(row[spec.pk]);
      if (!id) continue;
      prints[`${prefix}${id}`] = spec.fields.map((field) => cell(row[field])).join(" · ");
    }
    if (watch.primed) {
      for (const [key, value] of Object.entries(prints)) {
        if (watch.prints[key] === value) continue;
        const id = key.slice(prefix.length);
        const fresh = watch.prints[key] == null;
        alerts.push({
          title: fresh ? `New Carshipy ${spec.noun}` : `Carshipy ${spec.noun} changed`,
          body: fresh ? `${spec.who} read ${id}. This was not on the last check. ${spec.advice}` : `${spec.who} read ${id}. Now: ${value}. ${spec.advice}`,
        });
        if (alerts.length >= 3) break;
      }
    }
    for (const key of Object.keys(next)) {
      if (key.startsWith(prefix) && !(key in prints)) delete next[key];
    }
    Object.assign(next, prints);
    if (alerts.length >= 3) break;
  }
  if (watch.primed && !watch.reviewed) {
    const late = leads
      .filter((row) => {
        const missing = [row.preferredVehicle, row.location, row.budget].filter(blank).length;
        return missing > 0 && /deposit|book|sourc/i.test(cell(row.stage));
      })
      .slice(0, 2);
    for (const row of late) {
      if (alerts.length >= 3) break;
      alerts.push({
        title: `${cell(row.name) || "A lead"} needs you`,
        body: `Maya found gaps at stage ${cell(row.stage) || "unset"}. Open Aidyl before the next promise. Nothing was written.`,
      });
    }
  }
  const pending = desk ? watch.pending : [...watch.pending, ...alerts].slice(-20);
  const saved: WatchFile = {
    primed: true,
    reviewed: watch.primed,
    prints: next,
    pending,
    lastCheck: new Date().toISOString(),
  };
  await saveWatch(saved);
  for (const alert of alerts.slice(0, 3)) await ping(alert, desk);
  return alerts.length;
}

TaskManager.defineTask(TASK, async () => {
  try {
    await scanBook(false);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBookWatch() {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const registered = await TaskManager.isTaskRegisteredAsync(TASK);
    if (!registered) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {
    /* the foreground minute check, and the closed-app watcher, still run */
  }
}
