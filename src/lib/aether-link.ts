import { useAidyl } from "@/lib/store";
import type { Campaign } from "@/lib/campaigns";

let started = false;
let since = "";
let subscribed = false;

function keyBytes(publicKey: string) {
  const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base = (publicKey + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensurePush(publicKey: string) {
  if (subscribed || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const reg = await navigator.serviceWorker.register("/aether-sw.js");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  }
  await fetch("/api/aether", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "subscribe", subscription: sub.toJSON() }),
  });
  subscribed = true;
}

async function syncReminders() {
  const pending = useAidyl.getState().reminders.filter((item) => !item.fired);
  await Promise.all(
    pending.map((reminder) =>
      fetch("/api/aether", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "reminder", reminder }),
      }),
    ),
  );
}

async function tick() {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    void fetch("/api/aether", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "heartbeat" }),
    });
  }
  const res = await fetch(`/api/aether?since=${encodeURIComponent(since)}`);
  if (!res.ok) return;
  const json = (await res.json()) as {
    publicKey?: string;
    lastCheck?: string;
    lastError?: string;
    events?: { id: string; at: string }[];
    campaigns?: Campaign[];
    campaignGateway?: string;
  };
  if (json.publicKey) void ensurePush(json.publicKey).catch(() => undefined);
  if (json.lastCheck) useAidyl.getState().noteServerWatch(json.lastCheck, json.lastError || "");
  if (Array.isArray(json.campaigns) && json.campaigns.length) {
    useAidyl.getState().mergeServerCampaigns(json.campaigns);
  }
  if (json.campaignGateway && /not found/i.test(json.campaignGateway)) {
    const sync = useAidyl.getState().campaignSync;
    if (sync.state !== "live") {
      useAidyl.getState().setCampaignSync({ state: "missing", detail: json.campaignGateway, paused: sync.paused });
    }
  }
  if (Array.isArray(json.events) && json.events.length) {
    useAidyl.getState().ingestAether(json.events as Parameters<ReturnType<typeof useAidyl.getState>["ingestAether"]>[0]);
    since = json.events[json.events.length - 1].at;
  }
}

export function armAetherPush() {
  subscribed = false;
  void tick().catch(() => undefined);
}

export function startAetherLink() {
  if (started || typeof window === "undefined") return;
  started = true;
  void syncReminders().catch(() => undefined);
  void tick().catch(() => undefined);
  window.setInterval(() => void tick().catch(() => undefined), 20_000);
}

export function registerServerReminder(reminder: { id: string; title: string; note: string; fireAt: string; createdBy: string }) {
  void fetch("/api/aether", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "reminder", reminder }),
  }).catch(() => undefined);
}

export function cancelServerReminder(id: string) {
  void fetch("/api/aether", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "cancel-reminder", id }),
  }).catch(() => undefined);
}
