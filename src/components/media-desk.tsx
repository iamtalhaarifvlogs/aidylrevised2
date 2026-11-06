import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { InstagramDesk } from "@/components/instagram-desk";
import { pullPublicSocial } from "@/lib/intelligence";
import { useAidyl } from "@/lib/store";

const ACCOUNTS = [
  { id: "youtube", label: "YouTube", handle: "@betterdealtv" },
  { id: "instagram", label: "Instagram", handle: "@betterdealtv" },
  { id: "tiktok", label: "TikTok", handle: "@betterdeal.tv" },
  { id: "website", label: "Website", handle: "betterdealtv.com" },
] as const;

export type MediaChannel = (typeof ACCOUNTS)[number]["id"];

function checked(at?: string) {
  if (!at) return "Not read yet";
  const time = new Date(at);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : "Not read yet";
}

export function MediaHome({ leads }: { leads: { id: string; name: string }[] }) {
  const social = useAidyl((s) => s.socialWatch.snapshot);
  const ig = useAidyl((s) => s.igWatch.snapshot);
  const yt = social?.youtube;
  const tt = social?.tiktok;
  const counts: Record<MediaChannel, string> = {
    youtube: yt?.subscribers == null ? "Subscribers not on the page" : `${yt.subscribers.toLocaleString()} subscribers`,
    instagram: ig ? `${ig.followers.toLocaleString()} followers` : "Waiting on the public page",
    tiktok: tt ? `${tt.followers.toLocaleString()} followers` : "Waiting on the public profile",
    website: social?.site ? `${social.site.pages.length} public paths` : "Waiting on the homepage",
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs tracking-[0.18em] text-brass uppercase">Media desk</p>
        <h2 className="font-display text-3xl">What is public, by account</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          BetterDealTV is not the Carshipy book. There are no shipments, ports, financing partners, or logistics here. Each account below is only what that public page actually shows.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ACCOUNTS.map((account) => (
          <Link
            key={account.id}
            to="/crm/$slug/$section"
            params={{ slug: "betterdealtv", section: account.id }}
            className="aidyl-panel block rounded-xl border border-line bg-surface p-4"
          >
            <p className="text-xs tracking-[0.14em] text-muted uppercase">{account.label}</p>
            <h3 className="mt-1 font-display text-2xl">{account.handle}</h3>
            <p className="mt-2 text-sm">{counts[account.id]}</p>
            <p className="mt-3 text-sm text-brass">Open {account.label}</p>
          </Link>
        ))}
      </div>
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Leads</p>
            <h3 className="font-display text-2xl">{leads.length === 0 ? "No media leads yet" : `${leads.length} in this workspace`}</h3>
          </div>
          <Link to="/crm/$slug/$section" params={{ slug: "betterdealtv", section: "leads" }} className="text-sm text-brass">
            Open leads
          </Link>
        </div>
        {leads.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Audience contacts live here only if someone is actually entered. They are not Carshipy buyers.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {leads.slice(0, 4).map((lead) => (
              <li key={lead.id || lead.name}>{lead.name || "Unnamed lead"}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AccountView({ channel }: { channel: MediaChannel }) {
  if (channel === "instagram") return <InstagramDesk />;
  if (channel === "youtube") return <YouTubeAccount />;
  if (channel === "tiktok") return <TikTokAccount />;
  return <WebsiteAccount />;
}

function Refresh({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void pullPublicSocial(true).finally(() => setBusy(false));
      }}
      className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-60"
    >
      {busy ? "Reading…" : label}
    </button>
  );
}

function YouTubeAccount() {
  const social = useAidyl((s) => s.socialWatch.snapshot);
  const error = useAidyl((s) => s.socialWatch.error);
  const yt = social?.youtube;
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">YouTube</p>
          <h2 className="font-display text-3xl">@betterdealtv</h2>
          <p className="mt-1 text-sm text-muted">Public channel header and the video feed. View counts are not in that feed, so they are not shown.</p>
        </div>
        <Refresh label="Refresh channel" />
      </header>
      {error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Subscribers" value={yt?.subscribers == null ? "Not on page" : yt.subscribers.toLocaleString()} />
        <Stat label="Videos" value={yt?.videos == null ? "Not on page" : yt.videos.toLocaleString()} />
      </div>
      <p className="text-xs text-muted">Last public read {checked(social?.at)}.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {!yt?.latest.length ? <li className="px-4 py-6 text-sm text-muted">No public videos in the feed yet.</li> : null}
        {yt?.latest.map((video) => (
          <li key={video.id} className="px-4 py-3">
            <a href={video.url} className="text-sm text-brass" target="_blank" rel="noreferrer">
              {video.title}
            </a>
            <p className="text-xs text-muted">{video.published ? new Date(video.published).toLocaleString() : "Date not in the feed"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TikTokAccount() {
  const social = useAidyl((s) => s.socialWatch.snapshot);
  const error = useAidyl((s) => s.socialWatch.error);
  const tt = social?.tiktok;
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">TikTok</p>
          <h2 className="font-display text-3xl">@betterdeal.tv</h2>
          <p className="mt-1 text-sm text-muted">Public profile totals only. Per-video play counts were not on the profile, so they are not estimated.</p>
        </div>
        <Refresh label="Refresh profile" />
      </header>
      {error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p> : null}
      {tt ? (
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Followers" value={tt.followers.toLocaleString()} />
          <Stat label="Following" value={tt.following.toLocaleString()} />
          <Stat label="Likes" value={tt.likes.toLocaleString()} />
          <Stat label="Videos" value={tt.videos.toLocaleString()} />
        </dl>
      ) : (
        <p className="text-sm text-muted">Waiting on the public profile.</p>
      )}
      <p className="text-xs text-muted">Last public read {checked(social?.at)}.</p>
    </section>
  );
}

function WebsiteAccount() {
  const social = useAidyl((s) => s.socialWatch.snapshot);
  const error = useAidyl((s) => s.socialWatch.error);
  const site = social?.site;
  const pages = site?.pages ?? [];
  const groups = [
    { label: "Watch", items: pages.filter((page) => page.path.startsWith("/watch")) },
    { label: "Guides", items: pages.filter((page) => page.path.startsWith("/guides")) },
    { label: "Other paths", items: pages.filter((page) => !page.path.startsWith("/watch") && !page.path.startsWith("/guides")) },
  ].filter((group) => group.items.length > 0);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">Website</p>
          <h2 className="font-display text-3xl">{site?.title || "betterdealtv.com"}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{site?.description || "Waiting on the public homepage."}</p>
        </div>
        <Refresh label="Refresh site" />
      </header>
      {error ? <p className="rounded-md bg-clay-soft px-3 py-2 text-sm text-clay">{error}</p> : null}
      <p className="text-xs text-muted">Last public read {checked(social?.at)}. These are paths linked from the homepage, not a traffic report.</p>
      {groups.length === 0 ? <p className="text-sm text-muted">No public paths yet.</p> : null}
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="font-display text-2xl">{group.label}</h3>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {group.items.map((page) => (
              <li key={page.path} className="px-4 py-3">
                <a className="text-sm text-brass" href={`https://betterdealtv.com${page.path}`} target="_blank" rel="noreferrer">
                  {page.label}
                </a>
                <p className="text-xs text-muted">{page.path}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-3xl">{value}</p>
    </div>
  );
}
