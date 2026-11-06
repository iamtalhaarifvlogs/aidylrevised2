export type YtVideo = { id: string; title: string; published: string; url: string };
export type YtPublic = {
  title: string;
  channelUrl: string;
  subscribers: number | null;
  videos: number | null;
  latest: YtVideo[];
  note: string;
};
export type TtPublic = {
  username: string;
  nickname: string;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  url: string;
  note: string;
};
export type SitePublic = {
  title: string;
  description: string;
  url: string;
  pages: { path: string; label: string }[];
  note: string;
};
export type PublicSocial = {
  at: string;
  youtube: YtPublic | null;
  tiktok: TtPublic | null;
  site: SitePublic | null;
};

const CHANNEL = "UCsOdgicHZCL5yP48dWMGZxw";
const UA = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function decode(text: string) {
  return text
    .split("&" + "amp;").join("&")
    .split("&" + "quot;").join('"')
    .split("&" + "#39;").join("'")
    .split("&" + "lt;").join("<")
    .split("&" + "gt;").join(">");
}

async function pull(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 16000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function readYoutube(): Promise<YtPublic | null> {
  let html = "";
  let xml = "";
  try {
    html = await pull("https://www.youtube.com/@betterdealtv");
  } catch {
    html = "";
  }
  try {
    xml = await pull(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`);
  } catch {
    xml = "";
  }
  const subscribers = num(html.match(/"content":"([\d,]+)\s+subscribers?"/i)?.[1]);
  const videos = num(html.match(/"content":"([\d,]+)\s+videos?"/i)?.[1]);
  const latest: YtVideo[] = [];
  if (xml.includes("<entry>")) {
    for (const block of xml.split("<entry>").slice(1, 7)) {
      const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = block.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
      if (!id || !title) continue;
      latest.push({
        id,
        title: decode(title),
        published: published ?? "",
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
  }
  if (!latest.length && subscribers == null) return null;
  return {
    title: "Betterdealtv",
    channelUrl: "https://www.youtube.com/@betterdealtv",
    subscribers,
    videos,
    latest,
    note: "View counts are not in the public video feed, so they are not shown.",
  };
}

async function readTiktok(): Promise<TtPublic | null> {
  let html = "";
  try {
    html = await pull("https://www.tiktok.com/@betterdeal.tv");
  } catch {
    return null;
  }
  if (!html.includes("betterdeal.tv")) return null;
  const stats = html.match(/"stats":\{([^}]+)\}/)?.[1] ?? "";
  const pick = (key: string) => {
    const m = stats.match(new RegExp(`"${key}":(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const followers = pick("followerCount");
  const videos = pick("videoCount");
  if (followers == null || videos == null) return null;
  return {
    username: "betterdeal.tv",
    nickname: decode(html.match(/"nickname":"([^"]+)"/)?.[1] ?? "BetterDealTV"),
    followers,
    following: pick("followingCount") ?? 0,
    likes: pick("heartCount") ?? 0,
    videos,
    url: "https://www.tiktok.com/@betterdeal.tv",
    note: "Per-video play counts are not on the public profile, so they are omitted.",
  };
}

async function readSite(): Promise<SitePublic | null> {
  let html = "";
  try {
    html = await pull("https://betterdealtv.com");
  } catch {
    return null;
  }
  const title = decode(html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || "BetterDeal TV");
  const description = decode(
    html.match(/name="description" content="([^"]*)"/i)?.[1]?.trim() || "Automotive media for international buyers.",
  );
  const pages: SitePublic["pages"] = [];
  const seen = new Set<string>();
  for (const match of html.match(/href="(\/(?:watch|guides)\/[^"]+)"/g) ?? []) {
    const path = match.replace(/^href="/, "").replace(/"$/, "");
    if (seen.has(path)) continue;
    seen.add(path);
    const slug = path.split("/").filter(Boolean).pop() ?? path;
    pages.push({ path, label: slug.replace(/-/g, " ") });
    if (pages.length >= 8) break;
  }
  return { title, description, url: "https://betterdealtv.com", pages, note: "Public pages only. No private site analytics." };
}

export async function readPublicSocial(): Promise<PublicSocial> {
  const [youtube, tiktok, site] = await Promise.all([readYoutube(), readTiktok(), readSite()]);
  return { at: new Date().toISOString(), youtube, tiktok, site };
}
