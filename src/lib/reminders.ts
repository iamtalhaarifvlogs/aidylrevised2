import { diffWatch, type IgSnapshot } from "@/lib/instagram";
import { formatWhen, parseReminder } from "@/lib/reminder-parse";
import { cancelServerReminder, registerServerReminder } from "@/lib/aether-link";
import { blankActivity, useAidyl, type Reminder } from "@/lib/store";
import { uid } from "@/lib/utils";

export { formatWhen, parseReminder };

let igAt = 0;
let running = false;

function notify(title: string, body: string, href?: string) {
  useAidyl.getState().pushNotice({ title, body, href, kind: "info" });
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: href?.includes("betterdealtv") ? "betterdealtv" : "desk",
      action: "notify",
      message: `${title}. ${body}`,
      performedBy: "Aidyl",
      status: "success",
    }),
  );
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* inbox still has it */
    }
  }
}

export function sweepReminders() {
  const due = useAidyl.getState().reminders.filter((item) => !item.fired && new Date(item.fireAt).getTime() <= Date.now());
  for (const reminder of due) {
    useAidyl.getState().markReminderFired(reminder.id);
    notify(reminder.title, `${reminder.note || reminder.title} · set by ${reminder.createdBy}`, "/activity");
  }
}

export async function scheduleReminder(input: { title: string; note: string; fireAt: string; createdBy: string }) {
  const reminder: Reminder = { id: uid("rem"), fired: false, ...input };
  useAidyl.getState().addReminder(reminder);
  registerServerReminder(reminder);
  useAidyl.getState().pushActivity(
    blankActivity({
      crm: "desk",
      action: "reminder",
      message: `${input.createdBy} set a reminder: ${input.title} · ${formatWhen(input.fireAt)}`,
      performedBy: input.createdBy,
      status: "success",
      agent: input.createdBy,
    }),
  );
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission().catch(() => undefined);
  }
  sweepReminders();
  return reminder;
}

export function cancelReminder(id: string) {
  useAidyl.getState().removeReminder(id);
  cancelServerReminder(id);
}

export async function refreshInstagram(force = false): Promise<IgSnapshot | null> {
  if (!force && Date.now() - igAt < 90_000 && useAidyl.getState().igWatch.snapshot) {
    return useAidyl.getState().igWatch.snapshot;
  }
  igAt = Date.now();
  try {
    const res = await fetch("/api/instagram");
    const json = (await res.json()) as IgSnapshot & { error?: string };
    if (!res.ok || json.error || !json.username) {
      const message = json.error || "The public Instagram page did not answer.";
      useAidyl.getState().setIgWatch({ ...useAidyl.getState().igWatch, error: message });
      return useAidyl.getState().igWatch.snapshot;
    }
    const prev = useAidyl.getState().igWatch;
    const { next, events } = diffWatch(prev, json);
    useAidyl.getState().setIgWatch(next);
    if (!prev.primed) {
      useAidyl.getState().pushActivity(
        blankActivity({
          crm: "betterdealtv",
          action: "watch",
          message: `Watching @${json.username}: ${json.followers} followers, ${json.posts} posts.`,
          performedBy: "Randolph",
          status: "success",
          agent: "Randolph",
        }),
      );
      return json;
    }
    for (const event of events) notify(event.title, event.body, "/crm/betterdealtv/instagram");
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The public Instagram page did not answer.";
    useAidyl.getState().setIgWatch({ ...useAidyl.getState().igWatch, error: message });
    return useAidyl.getState().igWatch.snapshot;
  }
}

export function startDeskSignals() {
  if (running) return () => undefined;
  running = true;
  const tick = () => {
    sweepReminders();
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void refreshInstagram(false);
  };
  void refreshInstagram(true);
  const timer = setInterval(tick, 15_000);
  const onVis = () => {
    if (document.visibilityState === "visible") void refreshInstagram(true);
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
    running = false;
  };
}
