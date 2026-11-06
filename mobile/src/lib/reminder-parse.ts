export type ReminderDraft = {
  title: string;
  note: string;
  fireAt: string;
};

const WANT = /\b(remind me|set (?:a |an )?reminder|notify me|ping me|alert me|tap me)\b/i;
const DURATION = /\b(?:in|after|for)\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i;
const CLOCK = /\b(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i;

export function parseReminder(text: string): ReminderDraft | "when" | null {
  if (!WANT.test(text)) return null;
  const now = new Date();
  let fire: Date | null = null;
  const duration = text.match(DURATION);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    const ms = unit.startsWith("min")
      ? amount * 60_000
      : unit.startsWith("hour") || unit.startsWith("hr")
        ? amount * 3_600_000
        : unit.startsWith("week")
          ? amount * 7 * 86_400_000
          : amount * 86_400_000;
    const allowed = unit.startsWith("min") ? amount <= 24 * 60 * 30 : unit.startsWith("hour") || unit.startsWith("hr") ? amount <= 24 * 60 : unit.startsWith("week") ? amount <= 52 : amount <= 365;
    if (amount > 0 && allowed) fire = new Date(now.getTime() + ms);
  }
  if (!fire) {
    const clock = text.match(CLOCK);
    if (clock) {
      let hour = Number(clock[1]);
      const minute = clock[2] ? Number(clock[2]) : 0;
      const meridiem = clock[3]?.toLowerCase().replace(/\./g, "");
      if (meridiem?.startsWith("p") && hour < 12) hour += 12;
      if (meridiem?.startsWith("a") && hour === 12) hour = 0;
      if (!meridiem && hour <= 7) hour += 12;
      if (hour > 23 || minute > 59) return "when";
      const when = new Date(now);
      if (/\btomorrow\b/i.test(text)) when.setDate(when.getDate() + 1);
      when.setHours(hour, minute, 0, 0);
      if (when.getTime() <= now.getTime() + 15_000) when.setDate(when.getDate() + 1);
      fire = when;
    }
  }
  if (!fire && /\btomorrow\b/i.test(text)) {
    const when = new Date(now);
    when.setDate(when.getDate() + 1);
    when.setHours(9, 0, 0, 0);
    fire = when;
  }
  if (!fire) return "when";
  let title = text
    .replace(/^(please\s+)?/i, "")
    .replace(/\b(hey|hi)\s+(maya|randolph)\b[, ]*/i, "")
    .replace(WANT, " ")
    .replace(DURATION, " ")
    .replace(/\b(?:tomorrow|today)\b/gi, " ")
    .replace(CLOCK, " ")
    .replace(/\b(to|about|that|regarding|for)\b/gi, " ")
    .replace(/[:\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (title.length < 2) title = "Desk reminder";
  title = title.charAt(0).toUpperCase() + title.slice(1, 80);
  return { title, note: text.trim().slice(0, 180), fireAt: fire.toISOString() };
}

export function formatWhen(iso: string) {
  const when = new Date(iso);
  const diff = when.getTime() - Date.now();
  if (Number.isNaN(diff)) return "at the time you set";
  if (diff < 90_000) return "in about a minute";
  if (diff < 3_600_000) {
    const minutes = Math.max(1, Math.round(diff / 60_000));
    return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (diff < 20 * 3_600_000) {
    const hours = Math.max(1, Math.round(diff / 3_600_000));
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
