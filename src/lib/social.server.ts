import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PublicSocial, SitePage, TtPublic, YtPublic, YtVideo } from "@/lib/social";

const execFileAsync = promisify(execFile);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CHANNEL = "UCsOdgicHZCL5yP48dWMGZxw";

let cache: { at: number; snap: PublicSocial } | null = null;

async function curl(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "curl",
    ["-sS", "-L", "--max-time", "16", "-A", UA, "-H", "Accept-Language: en-US,en;q=0.9", url],
    { maxBuffer: 3_000_000 },
  );
  return stdout;
}

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function decode(text: string) {
  return text
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

async function readYoutube(): Promise<{ data: YtPublic | null; note?: string }> {
  const notes: string[] = [];
  let html = "";
  try {
    html = await curl("https://www.youtube.com/@betterdealtv");
  } catch {
    notes.push("The public YouTube page did not answer.");
  }
  const subscribers = num(html.match(/"content":"([\d,]+)\s+subscribers?"/i)?.[1]);
  const videos = num(html.match(/"content":"([\d,]+)\s+videos?"/i)?.[1]);
  let xml = "";
  try {
    xml = await curl(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`);
  } catch {
    notes.push("The public YouTube video feed did not answer.");
  }
  const latest: YtVideo[] = [];
  if (xml.includes("<entry>")) {
    for (const block of xml.split("<entry>").slice(1, 9)) {
      const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = block.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
      if (!id || !title) continue;
      latest.push({
        id,
        title: decode(title),
        published: published ?? "",
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
    }
  }
  if (!latest.length && subscribers == null) {
    return { data: null, note: notes[0] ?? "YouTube did not return public channel data." };
  }
  return {
    data: {
      title: "Betterdealtv",
      channelUrl: "https://www.youtube.com/@betterdealtv",
      subscribers,
      videos,
      latest,
    },
    note: latest.length ? "View counts are not in the public video feed, so they are not shown." : notes[0],
  };
}

async function readTiktok(): Promise<{ data: TtPublic | null; note?: string }> {
  let html = "";
  try {
    html = await curl("https://www.tiktok.com/@betterdeal.tv");
  } catch {
    return { data: null, note: "The public TikTok page did not answer." };
  }
  if (!html.includes("betterdeal.tv")) {
    return { data: null, note: "TikTok did not return the @betterdeal.tv profile." };
  }
  const stats = html.match(/"stats":\{([^}]+)\}/)?.[1] ?? "";
  const pick = (key: string) => {
    const m = stats.match(new RegExp(`"${key}":(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const followers = pick("followerCount");
  const videos = pick("videoCount");
  if (followers == null || videos == null) {
    return { data: null, note: "TikTok answered, but the public counts were not in the page." };
  }
  const nickname = html.match(/"nickname":"([^"]+)"/)?.[1] ?? "BetterDealTV";
  return {
    data: {
      username: "betterdeal.tv",
      nickname: decode(nickname),
      followers,
      following: pick("followingCount") ?? 0,
      likes: pick("heartCount") ?? 0,
      videos,
      url: "https://www.tiktok.com/@betterdeal.tv",
    },
    note: "TikTok did not include per-video play counts on the public profile, so those are omitted.",
  };
}

function labelFromPath(path: string) {
  const slug = path.split("/").filter(Boolean).pop() ?? path;
  return slug.replace(/-/g, " ");
}

async function readSite(): Promise<{ data: PublicSocial["site"]; note?: string }> {
  let html = "";
  try {
    html = await curl("https://betterdealtv.com");
  } catch {
    return { data: null, note: "betterdealtv.com did not answer." };
  }
  const title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "BetterDeal TV");
  const description = decode(
    html.match(/name="description" content="([^"]*)"/i)?.[1]?.trim() ||
      "Automotive media for international buyers.",
  );
  const pages: SitePage[] = [];
  const seen = new Set<string>();
  for (const path of html.match(/href="(\/(?:watch|guides)\/[^"]+)"/g) ?? []) {
    const href = path.replace(/^href="/, "").replace(/"$/, "");
    if (seen.has(href)) continue;
    seen.add(href);
    pages.push({ path: href, label: labelFromPath(href) });
    if (pages.length >= 8) break;
  }
  return { data: { title, description, url: "https://betterdealtv.com", pages } };
}

export async function readPublicSocial(): Promise<PublicSocial> {
  if (cache && Date.now() - cache.at < 60_000) return cache.snap;
  const [youtube, tiktok, site] = await Promise.all([readYoutube(), readTiktok(), readSite()]);
  const notes = [youtube.note, tiktok.note, site.note].filter((n): n is string => Boolean(n));
  const snap: PublicSocial = {
    at: new Date().toISOString(),
    youtube: youtube.data,
    tiktok: tiktok.data,
    site: site.data,
    notes,
  };
  cache = { at: Date.now(), snap };
  return snap;
}
