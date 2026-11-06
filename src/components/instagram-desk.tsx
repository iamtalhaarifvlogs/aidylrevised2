import { useState } from "react";
import { engagement, FOLLOWER_MILESTONES, nextMilestone, POST_MILESTONES, type IgSnapshot } from "@/lib/instagram";
import { refreshInstagram } from "@/lib/reminders";
import { useAidyl } from "@/lib/store";

function one(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 1 : 0 });
}

export function InstagramDesk() {
  const watch = useAidyl((s) => s.igWatch);
  const [pulling, setPulling] = useState(false);
  const snap = watch.snapshot;
  const stats = snap ? engagement(snap) : null;
  const followers = snap ? nextMilestone(snap.followers, FOLLOWER_MILESTONES) : null;
  const posts = snap ? nextMilestone(snap.posts, POST_MILESTONES) : null;

  async function pull() {
    setPulling(true);
    try {
      await refreshInstagram(true);
    } finally {
      setPulling(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 md:px-5">
        <div>
          <p className="text-xs tracking-[0.18em] text-brass uppercase">Public Instagram</p>
          <h2 className="font-display text-3xl">@betterdealtv</h2>
        </div>
        <button onClick={() => void pull()} className="rounded-full bg-ink px-4 py-2 text-sm text-paper" disabled={pulling}>
          {pulling ? "Reading…" : "Refresh page"}
        </button>
      </div>
      {!snap ? (
        <p className="px-4 py-6 text-sm text-muted md:px-5">
          {watch.error ?? "Reading the public page. Followers, posts, and the latest videos will land here. Nothing is invented."}
        </p>
      ) : (
        <div className="grid gap-6 px-4 py-5 md:px-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Profile snap={snap} />
            {stats ? <Performance stats={stats} followers={snap.followers} /> : null}
            {followers && posts ? <Milestones followers={snap.followers} posts={snap.posts} followerGoal={followers} postGoal={posts} /> : null}
            <p className="mt-4 text-xs text-muted">
              Last read {new Date(snap.fetchedAt).toLocaleTimeString()}. Counts are what the public page shows. Reach, impressions, and profile visits stay inside Instagram.
              {watch.error ? ` ${watch.error}` : ""}
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="grid grid-cols-3 gap-1">
              {snap.media.map((post) => (
                <a key={post.id} href={post.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden bg-brass-soft">
                  {post.thumbnail ? <img src={post.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                  <span className="absolute inset-x-0 bottom-0 bg-ink/75 px-1.5 py-1 text-xs text-paper">
                    {post.likes} likes{post.views != null ? ` · ${post.views} views` : ""}
                  </span>
                  {post.kind === "video" ? <span className="absolute top-1 left-1 rounded bg-ink/80 px-1.5 py-0.5 text-xs text-paper">Video</span> : null}
                </a>
              ))}
            </div>
            <ul className="mt-4 space-y-3">
              {snap.media.slice(0, 4).map((post) => (
                <li key={`${post.id}-line`} className="border-b border-line pb-3">
                  <p className="text-xs text-brass">
                    {post.kind === "video" ? "Video" : "Post"} · {post.takenAt ? new Date(post.takenAt * 1000).toLocaleDateString() : "Recent"} · {post.likes} likes
                    {post.views != null ? ` · ${post.views} views` : ""} · {post.comments} comments
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm">{post.caption.split("\n").map((line) => line.trim()).find(Boolean) ?? "No caption"}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function Profile({ snap }: { snap: IgSnapshot }) {
  return (
    <div className="flex gap-4">
      {snap.profilePic ? <img src={snap.profilePic} alt="" className="size-16 shrink-0 rounded-full object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-full bg-ink font-display text-paper">BD</div>}
      <div>
        <p className="font-display text-2xl leading-none">{snap.fullName}</p>
        <p className="mt-2 text-sm whitespace-pre-line text-muted">{snap.biography}</p>
        <a href="https://www.instagram.com/betterdealtv/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brass">
          Open on Instagram
        </a>
      </div>
    </div>
  );
}

function Performance({ stats, followers }: { stats: ReturnType<typeof engagement>; followers: number }) {
  const cells = [
    ["Followers", followers.toLocaleString()],
    ["Avg likes", one(stats.avgLikes)],
    ["Avg comments", one(stats.avgComments)],
    ["Avg views", stats.avgViews == null ? "—" : one(stats.avgViews)],
    ["Videos", String(stats.videos)],
    ["Engagement", stats.rate == null ? "—" : `${stats.rate.toFixed(1)}%`],
  ];
  return (
    <dl className="mt-4 grid grid-cols-3 gap-2">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-bg px-3 py-2">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="font-display text-2xl tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Milestones({
  followers,
  posts,
  followerGoal,
  postGoal,
}: {
  followers: number;
  posts: number;
  followerGoal: ReturnType<typeof nextMilestone>;
  postGoal: ReturnType<typeof nextMilestone>;
}) {
  return (
    <div className="mt-4 space-y-3">
      <Bar label={followerGoal.next ? `${followers.toLocaleString()} followers · next ${followerGoal.next.toLocaleString()}` : `${followers.toLocaleString()} followers`} progress={followerGoal.progress} />
      <Bar label={postGoal.next ? `${posts.toLocaleString()} posts · next ${postGoal.next.toLocaleString()}` : `${posts.toLocaleString()} posts`} progress={postGoal.progress} />
    </div>
  );
}

function Bar({ label, progress }: { label: string; progress: number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brass-soft">
        <div className="h-full rounded-full bg-brass" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}
