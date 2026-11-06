import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { engagement, FOLLOWER_MILESTONES, nextMilestone, POST_MILESTONES, type IgSnapshot } from "../lib/instagram";
import { refreshInstagram } from "../lib/reminders";
import { useDesk } from "../lib/store";
import { colors, fonts } from "../theme";

function one(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 1 : 0 });
}

export function InstagramDesk() {
  const snap = useDesk().igWatch?.snapshot ?? null;
  const error = useDesk().igWatch?.error ?? null;
  const [pulling, setPulling] = useState(false);
  const stats = snap ? engagement(snap) : null;
  const followerGoal = snap ? nextMilestone(snap.followers, FOLLOWER_MILESTONES) : null;
  const postGoal = snap ? nextMilestone(snap.posts, POST_MILESTONES) : null;

  async function pull() {
    setPulling(true);
    try {
      await refreshInstagram(true);
    } finally {
      setPulling(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PUBLIC INSTAGRAM</Text>
          <Text style={styles.h}>@betterdealtv</Text>
        </View>
        <Pressable onPress={() => void pull()} style={styles.refresh}>
          <Text style={styles.refreshText}>{pulling ? "Reading…" : "Refresh"}</Text>
        </Pressable>
      </View>
      {!snap ? <Text style={styles.p}>{error ?? "Reading the public page. Followers, posts, and the latest videos land here. Nothing is invented."}</Text> : null}
      {snap ? (
        <View style={{ gap: 12 }}>
          <Profile snap={snap} />
          {stats ? (
            <View style={styles.grid}>
              <Cell label="Followers" value={snap.followers.toLocaleString()} />
              <Cell label="Following" value={snap.following.toLocaleString()} />
              <Cell label="Posts" value={snap.posts.toLocaleString()} />
              <Cell label="Avg likes" value={one(stats.avgLikes)} />
              <Cell label="Avg comments" value={one(stats.avgComments)} />
              <Cell label="Avg views" value={stats.avgViews == null ? "—" : one(stats.avgViews)} />
              <Cell label="Videos" value={String(stats.videos)} />
              <Cell label="Engagement" value={stats.rate == null ? "—" : `${stats.rate.toFixed(1)}%`} />
            </View>
          ) : null}
          {followerGoal ? <Bar label={followerGoal.next ? `${snap.followers.toLocaleString()} followers · next ${followerGoal.next.toLocaleString()}` : `${snap.followers.toLocaleString()} followers`} progress={followerGoal.progress} /> : null}
          {postGoal ? <Bar label={postGoal.next ? `${snap.posts.toLocaleString()} posts · next ${postGoal.next.toLocaleString()}` : `${snap.posts.toLocaleString()} posts`} progress={postGoal.progress} /> : null}
          <View style={styles.tiles}>
            {snap.media.map((post) => (
              <Pressable key={post.id} onPress={() => void Linking.openURL(post.url)} style={styles.tile}>
                {post.thumbnail ? <Image source={{ uri: post.thumbnail }} style={styles.tileImg} /> : null}
                {post.kind === "video" ? <Text style={styles.badge}>Video</Text> : null}
                <Text style={styles.tileMeta}>{post.likes} likes{post.views != null ? ` · ${post.views}` : ""}</Text>
              </Pressable>
            ))}
          </View>
          {snap.media.slice(0, 3).map((post) => (
            <View key={`${post.id}-cap`} style={styles.caption}>
              <Text style={styles.kicker}>
                {post.kind === "video" ? "VIDEO" : "POST"} · {post.takenAt ? new Date(post.takenAt * 1000).toLocaleDateString() : "RECENT"} · {post.comments} comments
              </Text>
              <Text style={styles.p} numberOfLines={3}>{post.caption.split("\n").map((line) => line.trim()).find(Boolean) ?? "No caption"}</Text>
            </View>
          ))}
          <Text style={styles.note}>
            Last read {new Date(snap.fetchedAt).toLocaleTimeString()}. These are the public counts. Reach and impressions stay inside Instagram until the business account is connected.
            {error ? ` ${error}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Profile({ snap }: { snap: IgSnapshot }) {
  return (
    <View style={styles.profile}>
      {snap.profilePic ? <Image source={{ uri: snap.profilePic }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>BD</Text></View>}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name}>{snap.fullName}</Text>
        <Text style={styles.p}>{snap.biography}</Text>
        <Pressable onPress={() => void Linking.openURL("https://www.instagram.com/betterdealtv/")}>
          <Text style={styles.link}>Open on Instagram</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

function Bar({ label, progress }: { label: string; progress: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.p}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.bar, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.2, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 20 },
  note: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18 },
  refresh: { backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  refreshText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  profile: { flexDirection: "row", gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brassSoft },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, color: colors.cream, fontSize: 20 },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  link: { fontFamily: fonts.bodyMedium, color: colors.brass },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "31%", backgroundColor: colors.bg, borderRadius: 14, padding: 8, gap: 2 },
  cellValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  track: { height: 8, backgroundColor: colors.brassSoft, borderRadius: 99, overflow: "hidden" },
  bar: { height: 8, backgroundColor: colors.brass },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tile: { width: "32%", aspectRatio: 1, backgroundColor: colors.brassSoft, borderRadius: 8, overflow: "hidden" },
  tileImg: { width: "100%", height: "100%" },
  badge: { position: "absolute", top: 4, left: 4, backgroundColor: colors.ink, color: colors.cream, fontFamily: fonts.bodyMedium, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  tileMeta: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,25,21,0.72)", color: colors.cream, fontFamily: fonts.body, fontSize: 10, paddingHorizontal: 4, paddingVertical: 3 },
  caption: { gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
});
