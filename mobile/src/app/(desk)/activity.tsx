import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { readTable } from "../../lib/data";
import type { Row } from "../../lib/schema";
import { useDesk } from "../../lib/store";
import { cellText } from "../../lib/utils";
import { colors, fonts } from "../../theme";

export default function Activity() {
  const desk = useDesk();
  const [remote, setRemote] = useState<Row[]>([]);

  useEffect(() => {
    void readTable("carshipy", "tbl_workflow_logs")
      .then((rows) => setRemote(rows.slice(0, 30)))
      .catch(() => setRemote([]));
  }, [desk.activity.length]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>AETHER</Text>
      <Text style={styles.h}>What the desk just did</Text>
      <Text style={styles.p}>Phone actions land here immediately. Carshipy also writes them to the live workflow log.</Text>
      {desk.activity.length === 0 ? <Text style={styles.p}>Nothing filed on this phone yet. Create a record, or teach an agent.</Text> : null}
      {desk.activity.map((event) => (
        <View key={event.id} style={styles.card}>
          <Text style={styles.kicker}>{event.crm} · {event.action}</Text>
          <Text style={styles.body}>{event.message}</Text>
          <Text style={styles.p}>{event.performedBy}{event.agent ? ` via ${event.agent}` : ""}</Text>
        </View>
      ))}
      <Text style={styles.h2}>Live Carshipy log</Text>
      {remote.map((row, index) => (
        <View key={String(row.timestamp ?? index)} style={styles.card}>
          <Text style={styles.body}>{cellText(row.message || row.action)}</Text>
          <Text style={styles.p}>{cellText(row.performed_by)} · {cellText(row.timestamp)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 200, gap: 10 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1, fontSize: 11, textTransform: "uppercase" },
  h: { fontFamily: fonts.display, fontSize: 36, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginTop: 8 },
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 20 },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
});
