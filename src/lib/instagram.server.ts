import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { slimInstagram, type IgSnapshot } from "@/lib/instagram";

const execFileAsync = promisify(execFile);
const ENDPOINT = "https://www.instagram.com/api/v1/users/web_profile_info/?username=betterdealtv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let cache: { at: number; snap: IgSnapshot } | null = null;

async function pullJson(): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sS", "-L", "--max-time", "12", "-A", UA, "-H", "Accept: application/json", "-H", "X-IG-App-ID: 936619743392459", ENDPOINT],
      { maxBuffer: 4_000_000 },
    );
    const text = stdout.trim();
    if (text.startsWith("{")) return JSON.parse(text) as unknown;
  } catch {
    /* Node's fetch is often rate-limited by Instagram; curl is the fallback that matches a browser. */
  }
  const res = await fetch(ENDPOINT, {
    headers: { Accept: "application/json", "User-Agent": UA, "X-IG-App-ID": "936619743392459" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 160) || `Instagram answered ${res.status}`);
  return JSON.parse(text) as unknown;
}

export async function readBetterdeal(): Promise<IgSnapshot> {
  if (cache && Date.now() - cache.at < 45_000) return cache.snap;
  const json = await pullJson();
  const user = (json as { data?: { user?: Record<string, unknown> } }).data?.user;
  if (!user || typeof user.username !== "string") throw new Error("Instagram did not return @betterdealtv.");
  const snap = slimInstagram(user, true);
  cache = { at: Date.now(), snap };
  return snap;
}
