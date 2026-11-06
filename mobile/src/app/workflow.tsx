import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

const STEPS = [
  ["Detection", "Aether notices a new or changed lead, shipment, or logistics row."],
  ["Analysis", "Maya reads Carshipy. Randolph reads the wider desk. They use the rows that are actually there."],
  ["Recommendation", "You get a notice and a suggested next step. It is not an action yet."],
  ["Your decision", "Approve, refuse, change, or save it. Nothing is written until you say so."],
  ["Action", "Aether writes the row and the log. A campaign approval still does not publish or spend."],
  ["Result", "What happened stays next to the original note. One observation is not a new forecast."],
];

export default function WorkflowScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>HOW THE DESK MOVES</Text>
      <Text style={styles.h}>You stay the decision.</Text>
      <Text style={styles.p}>The phone watches the live book even when this app is closed. The first open only learns the book. The next change is what taps you.</Text>
      {STEPS.map(([title, body], index) => (
        <View key={title} style={styles.card}>
          <Text style={styles.kicker}>{index + 1}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.p}>{body}</Text>
        </View>
      ))}
      <View style={styles.row}>
        <Link href="/activity" style={styles.link}>Activity</Link>
        <Link href="/alerts" style={styles.link}>Alerts</Link>
        <Link href="/campaigns" style={styles.link}>Campaigns</Link>
        <Link href="/reports" style={styles.link}>Reports</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 140, gap: 12 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.2, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 34, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  link: { fontFamily: fonts.bodyMedium, color: colors.brass, fontSize: 16 },
});
