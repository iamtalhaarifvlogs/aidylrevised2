export type YtVideo = {
  id: string;
  title: string;
  published: string;
  url: string;
  thumbnail: string;
};

export type YtPublic = {
  title: string;
  channelUrl: string;
  subscribers: number | null;
  videos: number | null;
  latest: YtVideo[];
};

export type TtPublic = {
  username: string;
  nickname: string;
  followers: number;
  following: number;
  likes: number;
  videos: number;
  url: string;
};

export type SitePage = { path: string; label: string };

export type SitePublic = {
  title: string;
  description: string;
  url: string;
  pages: SitePage[];
};

export type PublicSocial = {
  at: string;
  youtube: YtPublic | null;
  tiktok: TtPublic | null;
  site: SitePublic | null;
  notes: string[];
};

export type SocialWatch = {
  primed: boolean;
  videoIds: string[];
  snapshot: PublicSocial | null;
  error: string | null;
};

export function emptySocialWatch(): SocialWatch {
  return { primed: false, videoIds: [], snapshot: null, error: null };
}
