import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAidyl, type Notice } from "@/lib/store";

function when(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  const mins = Math.round((Date.now() - time) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
}

export function NoticeBell() {
  const notices = useAidyl((s) => s.notices);
  const markOne = useAidyl((s) => s.markNoticeRead);
  const markAll = useAidyl((s) => s.markAllNoticesRead);
  const asked = useAidyl((s) => s.notifyAsked);
  const setAsked = useAidyl((s) => s.setNotifyAsked);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const unread = notices.filter((item) => !item.read).length;

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, [open, asked]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function allow() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setAsked(true);
    setPerm(result);
    if (result === "granted") {
      try {
        new Notification("Aidyl Systems", { body: "Notifications are on. Recommendations, reminders, and BetterDealTV updates will reach you." });
      } catch {
        /* bell still records them */
      }
    }
  }

  function openNotice(notice: Notice) {
    markOne(notice.id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        className="relative grid size-11 place-items-center rounded-md border border-line bg-surface transition-colors duration-200 hover:border-brass"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-clay px-1 text-xs text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="aidyl-pop z-50 mt-2 flex max-h-96 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg max-md:fixed max-md:inset-x-3 max-md:top-full max-md:w-auto md:absolute md:right-0 md:w-80">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="font-display text-lg">Notifications</p>
            <button type="button" className="text-xs text-brass" onClick={markAll} disabled={unread === 0}>
              Mark all read
            </button>
          </div>
          {perm === "default" ? (
            <div className="border-b border-line bg-brass-soft px-3 py-2">
              <p className="text-xs">Browser alerts are still off.</p>
              <button type="button" className="mt-1 text-sm text-brass" onClick={() => void allow()}>
                Allow notifications
              </button>
            </div>
          ) : null}
          {perm === "denied" ? (
            <p className="border-b border-line px-3 py-2 text-xs text-muted">The browser blocked alerts. This list still keeps them.</p>
          ) : null}
          <ul className="max-h-96 overflow-y-auto">
            {notices.length === 0 ? <li className="px-3 py-6 text-sm text-muted">Nothing has come in yet.</li> : null}
            {notices.map((notice) => {
              const inner = (
                <>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm break-words">{notice.title}</span>
                    {!notice.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-brass" /> : null}
                  </span>
                  <span className="mt-1 block text-xs break-words text-muted">{notice.body}</span>
                  <span className="mt-1 block text-xs text-muted">{when(notice.at)}</span>
                </>
              );
              return (
                <li key={notice.id} className={notice.read ? "border-b border-line" : "border-b border-line bg-brass-soft/60"}>
                  {notice.href ? (
                    <a href={notice.href} className="block px-3 py-3" onClick={() => openNotice(notice)}>
                      {inner}
                    </a>
                  ) : (
                    <button type="button" className="block w-full px-3 py-3 text-left" onClick={() => openNotice(notice)}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
