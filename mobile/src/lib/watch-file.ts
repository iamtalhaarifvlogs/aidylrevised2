import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";

export type WatchAlert = { title: string; body: string };

export type WatchFile = {
  primed: boolean;
  reviewed: boolean;
  prints: Record<string, string>;
  pending: WatchAlert[];
  lastCheck: string;
};

export type MirrorReminder = {
  id: string;
  title: string;
  note: string;
  fireAt: string;
  createdBy?: string;
  fired?: boolean;
  expoArmed?: boolean;
};

const WATCH_KEY = "aidyl-book-watch-v1";
const WATCH_NAME = "aether-watch.json";
const REMINDER_NAME = "aether-reminders.json";

const emptyWatch = (): WatchFile => ({ primed: false, reviewed: false, prints: {}, pending: [], lastCheck: "" });

function file(name: string) {
  return new File(Paths.document, name);
}

async function readRaw(name: string): Promise<string | null> {
  try {
    const target = file(name);
    if (!target.exists) return null;
    return await target.text();
  } catch {
    return null;
  }
}

function writeRaw(name: string, raw: string) {
  try {
    const target = file(name);
    if (!target.exists) target.create();
    target.write(raw);
  } catch {
    /* AsyncStorage still holds a copy for the in-app sweep */
  }
}

export async function loadWatch(): Promise<WatchFile> {
  const raw = await readRaw(WATCH_NAME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WatchFile>;
      return {
        primed: Boolean(parsed.primed),
        reviewed: Boolean(parsed.reviewed),
        prints: parsed.prints ?? {},
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        lastCheck: parsed.lastCheck ?? "",
      };
    } catch {
      /* fall through */
    }
  }
  try {
    const stored = await AsyncStorage.getItem(WATCH_KEY);
    if (stored) return { ...emptyWatch(), ...(JSON.parse(stored) as WatchFile), pending: [] };
  } catch {
    /* start fresh */
  }
  return emptyWatch();
}

export async function saveWatch(next: WatchFile) {
  const raw = JSON.stringify(next);
  writeRaw(WATCH_NAME, raw);
  try {
    await AsyncStorage.setItem(WATCH_KEY, raw);
  } catch {
    /* the file is what the closed-app watcher reads */
  }
}

export async function loadReminderMirror(): Promise<MirrorReminder[]> {
  const raw = await readRaw(REMINDER_NAME);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MirrorReminder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReminderMirror(items: MirrorReminder[]) {
  writeRaw(REMINDER_NAME, JSON.stringify(items));
}
