import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { readPublicSocial, type PublicSocial } from "../lib/public-social";
import { colors, fonts } from "../theme";

export function MediaAccounts({
  focus,
  onOpen,
}: {
  focus: "overview" | "youtube" | "instagram" | "tiktok" | "website";
  onOpen?: (id: "youtube" | "instagram" | "tiktok" | "website") => void;
}) {
  const [snap, setSnap] = useState<PublicSocial | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setSnap(await readPublicSocial());
    } catch (err) {
      setError(err instanceof Error ? err.message : "The public pages did not answer.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (focus === "instagram") return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.kicker}>PUBLIC ACCOUNTS</Text>
        <Pressable onPress={() => void load()}>
          <Text style={styles.link}>{busy ? "Reading…" : "Refresh"}</Text>
        </Pressable>
      </View>
      {!snap && !error ? <Text style={styles.p}>Reading the public pages. Nothing is filled in until they answer.</Text> : null}
      {error ? <Text style={styles.p}>{error}</Text> : null}
      {snap && (focus === "overview" || focus === "youtube") ? <Youtube snap={snap} compact={focus === "overview"} onOpen={onOpen} /> : null}
      {snap && (focus === "overview" || focus === "tiktok") ? <Tiktok snap={snap} compact={focus === "overview"} onOpen={onOpen} /> : null}
      {snap && (focus === "overview" || focus === "website") ? <Site snap={snap} compact={focus === "overview"} onOpen={onOpen} /> : null}
      {focus === "overview" && onOpen ? (
        <Pressable onPress={() => onOpen("instagram")} style={styles.card}>
          <Text style={styles.kicker}>INSTAGRAM</Text>
          <Text style={styles.h}>@betterdealtv</Text>
          <Text style={styles.p}>Public followers, posts, and recent media. Open the account for the full read.</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Youtube({ snap, compact, onOpen }: { snap: PublicSocial; compact: boolean; onOpen?: (id: "youtube") => void }) {
  const yt = snap.youtube;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>YOUTUBE</Text>
      <Text style={styles.h}>@betterdealtv</Text>
      {!yt ? <Text style={styles.p}>The public channel did not return counts or a video list.</Text> : null}
      {yt ? (
        <View style={{ gap: 8 }}>
          <View style={styles.grid}>
            <Cell label="Subscribers" value={yt.subscribers == null ? "Not on page" : yt.subscribers.toLocaleString()} />
            <Cell label="Videos" value={yt.videos == null ? "Not on page" : yt.videos.toLocaleString()} />
          </View>
          <Text style={styles.note}>{yt.note}</Text>
          {(compact ? yt.latest.slice(0, 2) : yt.latest).map((video) => (
            <Pressable key={video.id} onPress={() => void Linking.openURL(video.url)}>
              <Text style={styles.body}>{video.title}</Text>
              <Text style={styles.p}>{video.published ? video.published.slice(0, 10) : "Public"} · views not in the feed</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => void Linking.openURL(yt.channelUrl)}>
            <Text style={styles.link}>Open channel</Text>
          </Pressable>
        </View>
      ) : null}
      {compact && onOpen ? (
        <Pressable onPress={() => onOpen("youtube")}>
          <Text style={styles.link}>Full YouTube read</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tiktok({ snap, compact, onOpen }: { snap: PublicSocial; compact: boolean; onOpen?: (id: "tiktok") => void }) {
  const tt = snap.tiktok;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>TIKTOK</Text>
      <Text style={styles.h}>@betterdeal.tv</Text>
      {!tt ? <Text style={styles.p}>The public profile did not return counts. Nothing was guessed.</Text> : null}
      {tt ? (
        <View style={{ gap: 8 }}>
          <View style={styles.grid}>
            <Cell label="Followers" value={tt.followers.toLocaleString()} />
            <Cell label="Following" value={tt.following.toLocaleString()} />
            <Cell label="Likes" value={tt.likes.toLocaleString()} />
            <Cell label="Videos" value={tt.videos.toLocaleString()} />
          </View>
          <Text style={styles.note}>{tt.note}</Text>
          {!compact ? (
            <Pressable onPress={() => void Linking.openURL(tt.url)}>
              <Text style={styles.link}>Open profile</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {compact && onOpen ? (
        <Pressable onPress={() => onOpen("tiktok")}>
          <Text style={styles.link}>Full TikTok read</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Site({ snap, compact, onOpen }: { snap: PublicSocial; compact: boolean; onOpen?: (id: "website") => void }) {
  const site = snap.site;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>WEBSITE</Text>
      <Text style={styles.h}>{site?.title ?? "betterdealtv.com"}</Text>
      {!site ? <Text style={styles.p}>The site did not answer.</Text> : null}
      {site ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.p}>{site.description}</Text>
          <Text style={styles.note}>{site.note}</Text>
          {(compact ? site.pages.slice(0, 4) : site.pages).map((page) => (
            <Pressable key={page.path} onPress={() => void Linking.openURL(`${site.url}${page.path}`)}>
              <Text style={styles.body}>{page.label}</Text>
              <Text style={styles.p}>{page.path}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => void Linking.openURL(site.url)}>
            <Text style={styles.link}>Open site</Text>
          </Pressable>
        </View>
      ) : null}
      {compact && onOpen ? (
        <Pressable onPress={() => onOpen("website")}>
          <Text style={styles.link}>Full site read</Text>
        </Pressable>
      ) : null}
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.2, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 20 },
  body: { fontFamily: fonts.bodyMedium, color: colors.ink },
  note: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 18 },
  link: { fontFamily: fonts.bodyMedium, color: colors.brass },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { minWidth: "46%", flexGrow: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 10, gap: 4 },
  cellValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
});
