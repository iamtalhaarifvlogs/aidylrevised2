export type IgPost = {
  id: string;
  shortcode: string;
  kind: "video" | "photo";
  caption: string;
  likes: number;
  comments: number;
  views: number | null;
  takenAt: number;
  thumbnail: string;
  url: string;
};

export type IgSnapshot = {
  username: string;
  fullName: string;
  biography: string;
  profilePic: string;
  followers: number;
  following: number;
  posts: number;
  media: IgPost[];
  fetchedAt: string;
};

export type IgWatch = {
  primed: boolean;
  postIds: string[];
  milestones: string[];
  snapshot: IgSnapshot | null;
  error: string | null;
};

export const FOLLOWER_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
export const POST_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];
const LIKE_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];
const VIEW_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 50000];

export function emptyWatch(): IgWatch {
  return { primed: false, postIds: [], milestones: [], snapshot: null, error: null };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countOf(value: unknown): number {
  const row = asRecord(value);
  return asNumber(row?.count) ?? asNumber(value) ?? 0;
}

export function slimInstagram(user: Record<string, unknown>, proxyImages = false): IgSnapshot {
  const mediaRoot = asRecord(user.edge_owner_to_timeline_media);
  const edges = Array.isArray(mediaRoot?.edges) ? mediaRoot.edges : [];
  const media: IgPost[] = [];
  for (const edge of edges) {
    if (media.length >= 12) break;
    const node = asRecord(asRecord(edge)?.node);
    if (!node) continue;
    const shortcode = typeof node.shortcode === "string" ? node.shortcode : "";
    if (!shortcode) continue;
    const capRoot = asRecord(node.edge_media_to_caption);
    const capEdges = Array.isArray(capRoot?.edges) ? capRoot.edges : [];
    const capText = asRecord(asRecord(capEdges[0])?.node)?.text;
    const caption = typeof capText === "string" ? capText.slice(0, 500) : "";
    const isVideo = node.is_video === true;
    const rawThumb = typeof node.thumbnail_src === "string" ? node.thumbnail_src : typeof node.display_url === "string" ? node.display_url : "";
    media.push({
      id: String(node.id ?? shortcode),
      shortcode,
      kind: isVideo ? "video" : "photo",
      caption,
      likes: countOf(node.edge_liked_by) || countOf(node.edge_media_preview_like),
      comments: countOf(node.edge_media_to_comment),
      views: isVideo ? asNumber(node.video_view_count) : null,
      takenAt: asNumber(node.taken_at_timestamp) ?? 0,
      thumbnail: proxyImages && rawThumb ? `/api/ig-img?u=${encodeURIComponent(rawThumb)}` : rawThumb,
      url: `https://www.instagram.com/p/${shortcode}/`,
    });
  }
  const rawPic = typeof user.profile_pic_url_hd === "string" ? user.profile_pic_url_hd : typeof user.profile_pic_url === "string" ? user.profile_pic_url : "";
  return {
    username: typeof user.username === "string" ? user.username : "betterdealtv",
    fullName: typeof user.full_name === "string" ? user.full_name : "BetterDealTV",
    biography: typeof user.biography === "string" ? user.biography : "",
    profilePic: proxyImages && rawPic ? `/api/ig-img?u=${encodeURIComponent(rawPic)}` : rawPic,
    followers: countOf(user.edge_followed_by),
    following: countOf(user.edge_follow),
    posts: asNumber(mediaRoot?.count) ?? media.length,
    media,
    fetchedAt: new Date().toISOString(),
  };
}

export function milestoneKeys(snap: IgSnapshot): string[] {
  const keys: string[] = [];
  for (const step of FOLLOWER_MILESTONES) if (snap.followers >= step) keys.push(`followers:${step}`);
  for (const step of POST_MILESTONES) if (snap.posts >= step) keys.push(`posts:${step}`);
  for (const post of snap.media) {
    for (const step of LIKE_MILESTONES) if (post.likes >= step) keys.push(`likes:${post.id}:${step}`);
    if (post.views != null) for (const step of VIEW_MILESTONES) if (post.views >= step) keys.push(`views:${post.id}:${step}`);
  }
  return keys;
}

export type WatchEvent = { title: string; body: string };

function describeMilestone(key: string, snap: IgSnapshot): WatchEvent | null {
  const [kind, a, b] = key.split(":");
  if (kind === "followers") return { title: "BetterdealTV milestone", body: `@betterdealtv reached ${Number(a).toLocaleString()} followers.` };
  if (kind === "posts") return { title: "BetterdealTV milestone", body: `@betterdealtv has published ${Number(a).toLocaleString()} posts.` };
  if (kind === "likes") {
    const post = snap.media.find((item) => item.id === a);
    const line = post?.caption.split("\n").map((part) => part.trim()).find(Boolean)?.slice(0, 80);
    return { title: "BetterdealTV milestone", body: `A post reached ${Number(b).toLocaleString()} likes${line ? ` — ${line}` : ""}.` };
  }
  if (kind === "views") return { title: "BetterdealTV milestone", body: `A video reached ${Number(b).toLocaleString()} views.` };
  return null;
}

export function diffWatch(prev: IgWatch, snap: IgSnapshot): { next: IgWatch; events: WatchEvent[] } {
  const freshIds = snap.media.map((post) => post.id);
  const milestones = milestoneKeys(snap);
  if (!prev.primed) {
    return { next: { primed: true, postIds: freshIds, milestones, snapshot: snap, error: null }, events: [] };
  }
  const known = new Set(prev.postIds);
  const seen = new Set(prev.milestones);
  const events: WatchEvent[] = [];
  for (const post of snap.media) {
    if (known.has(post.id)) continue;
    const line = post.caption.split("\n").map((part) => part.trim()).find(Boolean) ?? (post.kind === "video" ? "A new video is on the page." : "A new post is on the page.");
    events.push({
      title: post.kind === "video" ? "BetterdealTV posted a video" : "BetterdealTV posted",
      body: line.slice(0, 160),
    });
  }
  for (const key of milestones) {
    if (seen.has(key)) continue;
    const parts = key.split(":");
    if ((parts[0] === "likes" || parts[0] === "views") && parts[1] && !known.has(parts[1])) continue;
    const described = describeMilestone(key, snap);
    if (described) events.push(described);
  }
  return {
    next: {
      primed: true,
      postIds: [...new Set([...prev.postIds, ...freshIds])].slice(-80),
      milestones: [...new Set([...prev.milestones, ...milestones])].slice(-240),
      snapshot: snap,
      error: null,
    },
    events,
  };
}

export function nextMilestone(current: number, steps: number[]) {
  const next = steps.find((step) => step > current) ?? null;
  const prev = [...steps].reverse().find((step) => step <= current) ?? 0;
  const span = next == null ? 1 : Math.max(1, next - prev);
  const progress = next == null ? 1 : Math.min(1, Math.max(0, (current - prev) / span));
  return { next, prev, progress };
}

export function engagement(snap: IgSnapshot) {
  const sample = snap.media.length;
  const likes = snap.media.reduce((sum, post) => sum + post.likes, 0);
  const comments = snap.media.reduce((sum, post) => sum + post.comments, 0);
  const videos = snap.media.filter((post) => post.kind === "video");
  const viewed = videos.filter((post) => post.views != null);
  const views = viewed.reduce((sum, post) => sum + (post.views ?? 0), 0);
  return {
    sample,
    videos: videos.length,
    avgLikes: sample ? likes / sample : 0,
    avgComments: sample ? comments / sample : 0,
    avgViews: viewed.length ? views / viewed.length : null,
    rate: snap.followers > 0 && sample ? ((likes + comments) / sample / snap.followers) * 100 : null,
    best: [...snap.media].sort((a, b) => b.likes - a.likes || (b.views ?? 0) - (a.views ?? 0))[0] ?? null,
  };
}
