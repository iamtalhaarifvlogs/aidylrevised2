import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { InstagramDesk } from "../../components/InstagramDesk";
import { MediaAccounts } from "../../components/MediaAccounts";
import { Records } from "../../components/Records";
import { Reports } from "../../components/Reports";
import { TrainPanel } from "../../components/TrainPanel";
import { crmBySlug, readTable } from "../../lib/data";
import { SECTION_TABLE, sectionsFor } from "../../lib/schema";
import { asNumber, money } from "../../lib/utils";
import { colors, fonts } from "../../theme";

const MEDIA = new Set(["youtube", "instagram", "tiktok", "website"]);

export default function Company() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const crm = crmBySlug(slug === "ogamoto" ? "carshipy" : slug);
  const media = crm?.slug === "betterdealtv";
  const [section, setSection] = useState(media ? "overview" : "overview");
  const [stages, setStages] = useState<{ label: string; count: number }[]>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [pipe, setPipe] = useState(0);

  useEffect(() => {
    setSection("overview");
  }, [slug]);

  useEffect(() => {
    if (!crm) return;
    void readTable(crm.slug, "tbl_leads")
      .then((rows) => {
        setLeadCount(rows.length);
        setPipe(rows.reduce((sum, row) => sum + (asNumber(row.budget) ?? 0), 0));
        const map = new Map<string, number>();
        for (const row of rows) {
          const key = String(row.stage ?? "unset");
          map.set(key, (map.get(key) ?? 0) + 1);
        }
        setStages([...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count })));
      })
      .catch(() => setLeadCount(null));
  }, [crm?.slug, section]);

  const max = useMemo(() => Math.max(1, ...stages.map((stage) => stage.count)), [stages]);
  if (!crm) {
    return (
      <View style={styles.page}>
        <Text style={styles.h}>No company named {slug}</Text>
      </View>
    );
  }

  const sections = sectionsFor(crm.slug);
  const tableId = SECTION_TABLE[section];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ headerShown: false, title: crm.name }} />
      <Text style={styles.kicker}>{crm.live ? "LIVE DYNAMO" : "ON THIS PHONE"}</Text>
      <Text style={styles.h}>{crm.name}</Text>
      <Text style={styles.p}>{crm.focus}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Overview" on={section === "overview"} onPress={() => setSection("overview")} />
        {sections.map((item) => (
          <Chip key={item.id} label={item.label} on={section === item.id} onPress={() => setSection(item.id)} />
        ))}
      </ScrollView>
      {media && section !== "instagram" && (section === "overview" || MEDIA.has(section)) ? (
        <MediaAccounts
          focus={section === "overview" ? "overview" : (section as "youtube" | "instagram" | "tiktok" | "website")}
          onOpen={(id) => setSection(id)}
        />
      ) : null}
      {media && section === "instagram" ? <InstagramDesk /> : null}
      {section === "overview" && !media ? (
        <View style={{ gap: 10 }}>
          <View style={styles.stats}>
            <View style={styles.statDark}>
              <Text style={styles.statLabel}>Leads</Text>
              <Text style={styles.statValue}>{leadCount ?? "—"}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.kicker}>Pipeline</Text>
              <Text style={styles.pipe}>{leadCount == null ? "—" : money(pipe)}</Text>
            </View>
          </View>
          <Text style={styles.h2}>Stages</Text>
          {stages.length === 0 ? <Text style={styles.p}>No stage mix yet.</Text> : null}
          {stages.map((stage) => (
            <View key={stage.label} style={{ gap: 4 }}>
              <Text style={styles.p}>{stage.label} · {stage.count}</Text>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.round((stage.count / max) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {section === "overview" && media ? (
        <View style={styles.stat}>
          <Text style={styles.kicker}>Leads on this phone</Text>
          <Text style={styles.pipe}>{leadCount ?? "—"}</Text>
          <Text style={styles.p}>Shipments, ports, financing, and calls are not this media desk.</Text>
        </View>
      ) : null}
      {section === "training" ? <TrainPanel defaultAgent={crm.agent === "maya" ? "maya" : "randolph"} crmSlug={crm.slug} /> : null}
      {section === "reports" ? <Reports lockedSlug={crm.slug} /> : null}
      {section === "activity" ? <Text style={styles.p}>Open the Activity tab for the phone log and the live Carshipy workflow.</Text> : null}
      {tableId && !(media && section !== "leads") ? <Records slug={crm.slug} tableId={tableId} /> : null}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 200, gap: 10 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.5, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 21 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.ink },
  chipTextOn: { color: colors.cream },
  stats: { flexDirection: "row", gap: 8 },
  statDark: { flex: 1, backgroundColor: colors.ink, borderRadius: 16, padding: 12, gap: 4 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 4 },
  statLabel: { fontFamily: fonts.body, color: "rgba(247,241,230,0.7)", fontSize: 12 },
  statValue: { fontFamily: fonts.display, color: colors.cream, fontSize: 32 },
  pipe: { fontFamily: fonts.display, color: colors.ink, fontSize: 22 },
  track: { height: 8, backgroundColor: colors.brassSoft, borderRadius: 99, overflow: "hidden" },
  bar: { height: 8, backgroundColor: colors.brass, borderRadius: 99 },
});
