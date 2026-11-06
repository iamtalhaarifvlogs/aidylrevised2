import { AppState, Platform } from "react-native";
import { diffWatch, slimInstagram, type IgSnapshot } from "./instagram";
import { ensureDeskChannel, scheduleNativeAt, cancelNative } from "./notify";
import { registerBookWatch, scanBook } from "./book-watch";
import { formatWhen, parseReminder } from "./reminder-parse";
import { addReminder, getState, markReminderFired, pushActivity, pushNotice, removeReminder, setIgWatch } from "./store";
import type { Reminder } from "./types";
import { uid } from "./utils";
import { loadReminderMirror, saveReminderMirror } from "./watch-file";
import * as Notifications from "expo-notifications";

export { formatWhen, parseReminder };

const ENDPOINT = "https://www.instagram.com/api/v1/users/web_profile_info/?username=betterdealtv";
let igAt = 0;

async function loadInstagram(): Promise<IgSnapshot> {
  if (Platform.OS === "web") {
    const res = await fetch("/api/instagram");
    const json = (await res.json()) as IgSnapshot & { error?: string };
    if (!res.ok || json.error || !json.username) throw new Error(json.error || "The public Instagram page did not answer.");
    return json;
  }
  const res = await fetch(ENDPOINT, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "X-IG-App-ID": "936619743392459",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("The public Instagram page did not answer.");
  const json = JSON.parse(text) as { data?: { user?: Record<string, unknown> } };
  const user = json.data?.user;
  if (!user || typeof user.username !== "string") throw new Error("Instagram did not return @betterdealtv.");
  return slimInstagram(user, false);
}

function notify(title: string, body: string) {
  pushNotice({ title, body });
  pushActivity({
    crm: "betterdealtv",
    action: "notify",
    message: `${title}. ${body}`,
    performedBy: "Aidyl",
    status: "success",
  });
  if (Platform.OS === "web" && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* inbox still has it */
    }
  }
}

function mirrorReminders() {
  saveReminderMirror(
    (getState().reminders ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      note: item.note,
      fireAt: item.fireAt,
      createdBy: item.createdBy,
      fired: item.fired,
      expoArmed: item.expoArmed,
    })),
  );
}

async function adoptNativeReminders() {
  const mirrored = await loadReminderMirror();
  const fired = new Set(mirrored.filter((item) => item.fired).map((item) => item.id));
  for (const reminder of getState().reminders ?? []) {
    if (!reminder.fired && fired.has(reminder.id)) {
      markReminderFired(reminder.id);
      pushNotice({ title: reminder.title, body: `${reminder.note || reminder.title} · set by ${reminder.createdBy}` });
    }
  }
}

export function sweepReminders() {
  const due = (getState().reminders ?? []).filter((item) => !item.fired && new Date(item.fireAt).getTime() <= Date.now());
  for (const reminder of due) {
    markReminderFired(reminder.id);
    notify(reminder.title, `${reminder.note || reminder.title} · set by ${reminder.createdBy}`);
    if (!reminder.expoArmed && Platform.OS !== "web") {
      void Notifications.scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.note || reminder.title, sound: true },
        trigger: null,
      }).catch(() => undefined);
    }
  }
  if (due.length) mirrorReminders();
}

export async function scheduleReminder(input: { title: string; note: string; fireAt: string; createdBy: string }) {
  const reminder: Reminder = { id: uid("rem"), fired: false, expoArmed: false, ...input };
  const wait = new Date(input.fireAt).getTime() - Date.now();
  if (wait > 1500) reminder.expoArmed = await scheduleNativeAt(reminder.id, input.title, input.note || input.title, new Date(input.fireAt));
  addReminder(reminder);
  mirrorReminders();
  pushActivity({
    crm: "desk",
    action: "reminder",
    message: `${input.createdBy} set a reminder: ${input.title} · ${formatWhen(input.fireAt)}`,
    performedBy: input.createdBy,
    status: "success",
    agent: input.createdBy,
  });
  if (Platform.OS === "web" && typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
  sweepReminders();
  return reminder;
}

export function cancelReminder(id: string) {
  removeReminder(id);
  void cancelNative(id);
  mirrorReminders();
}

export async function refreshInstagram(force = false): Promise<IgSnapshot | null> {
  const current = getState().igWatch;
  if (!force && Date.now() - igAt < 90_000 && current?.snapshot) return current.snapshot;
  igAt = Date.now();
  try {
    const snap = await loadInstagram();
    const prev = getState().igWatch ?? { primed: false, postIds: [], milestones: [], snapshot: null, error: null };
    const { next, events } = diffWatch(prev, snap);
    setIgWatch(next);
    if (!prev.primed) {
      pushActivity({
        crm: "betterdealtv",
        action: "watch",
        message: `Watching @${snap.username}: ${snap.followers} followers, ${snap.posts} posts.`,
        performedBy: "Randolph",
        status: "success",
        agent: "Randolph",
      });
      return snap;
    }
    for (const event of events) notify(event.title, event.body);
    return snap;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The public Instagram page did not answer.";
    setIgWatch({ ...(getState().igWatch ?? { primed: false, postIds: [], milestones: [], snapshot: null, error: null }), error: message });
    return getState().igWatch.snapshot;
  }
}

export function startDeskSignals() {
  void ensureDeskChannel();
  void registerBookWatch();
  void adoptNativeReminders().then(() => {
    mirrorReminders();
    sweepReminders();
  });
  const tick = () => {
    if (AppState.currentState !== "active") return;
    sweepReminders();
    void refreshInstagram(false);
    void scanBook(true).catch(() => undefined);
  };
  void refreshInstagram(true);
  const timer = setInterval(tick, 60_000);
  const soon = setTimeout(tick, 4_000);
  const sub = AppState.addEventListener("change", (status) => {
    if (status === "active") {
      void adoptNativeReminders().then(() => sweepReminders());
      void refreshInstagram(true);
      void scanBook(true).catch(() => undefined);
    }
  });
  return () => {
    clearInterval(timer);
    clearTimeout(soon);
    sub.remove();
  };
}
