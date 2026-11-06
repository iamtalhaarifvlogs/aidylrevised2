import { useEffect, useState } from "react";
import { armAetherPush } from "@/lib/aether-link";
import { useAidyl } from "@/lib/store";

export function NotifyBanner() {
  const asked = useAidyl((s) => s.notifyAsked);
  const setAsked = useAidyl((s) => s.setNotifyAsked);
  const pushNotice = useAidyl((s) => s.pushNotice);
  const [perm, setPerm] = useState<NotificationPermission | "none" | "">("");

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "none" : Notification.permission);
  }, [asked]);

  if (asked || perm !== "default") return null;

  async function allow() {
    const result = await Notification.requestPermission();
    setAsked(true);
    setPerm(result);
    if (result === "granted") {
      armAetherPush();
      pushNotice({
        title: "Notifications are on",
        body: "Recommendations, reminders, and BetterDealTV updates will also appear as browser alerts.",
        kind: "system",
        read: true,
      });
      try {
        new Notification("Aidyl Systems", { body: "Notifications are on. The bell keeps a copy either way." });
      } catch {
        /* permission can still be granted when the constructor is blocked */
      }
    }
  }

  return (
    <div className="aidyl-rise border-b border-line bg-brass-soft px-4 py-3 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm">
          Allow notifications so Aether can reach you when this tab is closed. New leads, shipment changes, and reminders use the same permission. The bell still keeps a copy if you skip this.
        </p>
        <div className="flex gap-2">
          <button type="button" className="rounded-full bg-ink px-4 py-2 text-sm text-paper" onClick={() => void allow()}>
            Allow
          </button>
          <button type="button" className="rounded-full border border-line bg-surface px-4 py-2 text-sm" onClick={() => setAsked(true)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
