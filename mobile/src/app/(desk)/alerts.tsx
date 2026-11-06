import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { askNotificationPermission, setMorningBrief } from "../../lib/notify";
import { cancelReminder, formatWhen, scheduleReminder } from "../../lib/reminders";
import { patch, useDesk } from "../../lib/store";
import { colors, fonts } from "../../theme";

export default function Alerts() {
  const desk = useDesk();
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("30");

  function addIn(minutes: number) {
    const label = title.trim() || "Desk reminder";
    void scheduleReminder({
      title: label,
      note: label,
      fireAt: new Date(Date.now() + minutes * 60_000).toISOString(),
      createdBy: "Admin",
    });
    setTitle("");
    setStatus(`Set. I'll tap you in ${minutes} minutes.`);
  }

  function addTomorrow() {
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(9, 0, 0, 0);
    const label = title.trim() || "Desk reminder";
    void scheduleReminder({ title: label, note: label, fireAt: when.toISOString(), createdBy: "Admin" });
    setTitle("");
    setStatus("Set for tomorrow at 9:00.");
  }

  const upcoming = (desk.reminders ?? []).filter((item) => !item.fired);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>NOTIFICATIONS</Text>
      <Text style={styles.h}>The desk can tap you on the shoulder.</Text>
      <Text style={styles.p}>
        Allow notifications once, then you can leave Aidyl. A phone alarm checks the live Carshipy book about every minute after that: new leads, shipments, logistics, calls, financing, and ports. Maya reads a lead, a call, or a lender. Randolph reads a shipment, a logistics row, or a port. You get the tap. Nothing is written until you approve. The first check only learns the book that is already there. The next change is what taps you. If the phone is idle, Android may wait several minutes. The phone asks once to leave Aidyl off battery limits so that wait stays short. Force-stopping Aidyl pauses the watch until you open it again.
      </Text>
      <Pressable
        onPress={() => {
          void askNotificationPermission(true).then((ok) => setStatus(ok ? "Notifications are on for this phone." : "Permission was not granted. Alerts still collect here. If the phone blocked them, settings just opened."));
        }}
        style={styles.primary}
      >
        <Text style={styles.primaryText}>Allow phone notifications</Text>
      </Pressable>
      {status ? <Text style={styles.p}>{status}</Text> : null}
      <Pressable onPress={() => patch({ notifyWrites: !desk.notifyWrites })} style={styles.card}>
        <Text style={styles.cardTitle}>When Aether writes</Text>
        <Text style={styles.p}>{desk.notifyWrites ? "On — you'll get a notification and a line here." : "Off — the inbox stays quiet."}</Text>
      </Pressable>
      <Pressable onPress={() => void setMorningBrief(!desk.morningBrief)} style={styles.card}>
        <Text style={styles.cardTitle}>Morning book, 8:30</Text>
        <Text style={styles.p}>{desk.morningBrief ? "Scheduled each day." : "Not scheduled."}</Text>
      </Pressable>
      <Text style={styles.h2}>Reminders</Text>
      <Text style={styles.p}>Or tell Maya and Randolph in the chat. “Remind me in 2 hours to review the page.”</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="What should I remind you about?" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={[styles.input, styles.amount]} />
        <Pressable onPress={() => addIn(Math.max(1, Number(amount) || 30))} style={styles.primary}>
          <Text style={styles.primaryText}>Minutes from now</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Pressable onPress={() => addIn(15)} style={styles.chip}><Text style={styles.chipText}>15 min</Text></Pressable>
        <Pressable onPress={() => addIn(60)} style={styles.chip}><Text style={styles.chipText}>1 hour</Text></Pressable>
        <Pressable onPress={addTomorrow} style={styles.chip}><Text style={styles.chipText}>Tomorrow 9:00</Text></Pressable>
      </View>
      {upcoming.length === 0 ? <Text style={styles.p}>No reminders waiting.</Text> : null}
      {upcoming.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.p}>{formatWhen(item.fireAt)} · {item.createdBy}</Text>
          <Pressable onPress={() => cancelReminder(item.id)}><Text style={styles.remove}>Cancel</Text></Pressable>
        </View>
      ))}
      <Text style={styles.h2}>Inbox</Text>
      {desk.notices.length === 0 ? <Text style={styles.p}>No alerts yet.</Text> : null}
      {desk.notices.map((notice) => (
        <View key={notice.id} style={styles.card}>
          <Text style={styles.kicker}>{notice.title}</Text>
          <Text style={styles.body}>{notice.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 200, gap: 12 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.4, fontSize: 11 },
  h: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, lineHeight: 21 },
  body: { fontFamily: fonts.body, color: colors.ink },
  primary: { backgroundColor: colors.ink, borderRadius: 999, alignItems: "center", paddingVertical: 14 },
  primaryText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontFamily: fonts.body, color: colors.ink },
  amount: { width: 84 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { backgroundColor: colors.brassSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.ink },
  remove: { fontFamily: fonts.bodyMedium, color: colors.clay },
});
