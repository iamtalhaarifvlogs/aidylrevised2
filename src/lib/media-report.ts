import type { ReportSection } from "@/lib/agents/pdf";
import { useAidyl } from "@/lib/store";

export function mediaPublicSection(): ReportSection {
  const social = useAidyl.getState().socialWatch.snapshot;
  const ig = useAidyl.getState().igWatch.snapshot;
  const rows: string[][] = [];
  if (ig) {
    rows.push([
      "Instagram",
      `@${ig.username}`,
      String(ig.followers),
      `${ig.posts} posts`,
      "Public profile. Reach and impressions are not on the page.",
    ]);
  } else {
    rows.push(["Instagram", "@betterdealtv", "—", "—", "Public page has not been read yet."]);
  }
  const yt = social?.youtube;
  if (yt) {
    rows.push([
      "YouTube",
      "@betterdealtv",
      yt.subscribers == null ? "Not on page" : String(yt.subscribers),
      yt.videos == null ? "Not on page" : `${yt.videos} videos`,
      "RSS has titles and dates, not view counts.",
    ]);
    for (const video of yt.latest.slice(0, 8)) {
      rows.push(["YouTube video", video.title, video.published ? video.published.slice(0, 10) : "—", video.url, "Public feed"]);
    }
  } else {
    rows.push(["YouTube", "@betterdealtv", "—", "—", "Public channel has not been read yet."]);
  }
  const tt = social?.tiktok;
  if (tt) {
    rows.push([
      "TikTok",
      `@${tt.username}`,
      String(tt.followers),
      `${tt.videos} videos`,
      `${tt.likes} likes. Per-video plays were not on the public profile.`,
    ]);
  } else {
    rows.push(["TikTok", "@betterdeal.tv", "—", "—", "Public profile has not been read yet."]);
  }
  const site = social?.site;
  if (site) {
    rows.push(["Website", site.title || "betterdealtv.com", String(site.pages.length), "pages", site.description || "No description on the homepage."]);
    for (const page of site.pages.slice(0, 12)) {
      rows.push(["Site page", page.label, page.path, `https://betterdealtv.com${page.path}`, "Listed on the homepage"]);
    }
  } else {
    rows.push(["Website", "betterdealtv.com", "—", "—", "Homepage has not been read yet."]);
  }
  return {
    heading: "Public accounts",
    columns: ["Source", "Name", "Count", "Catalog", "What this is"],
    rows,
  };
}
