import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteTraining, saveTraining } from "../lib/data";
import { addSpecialist, removeSpecialist, useDesk } from "../lib/store";
import { nowIso, uid } from "../lib/utils";
import { colors, fonts } from "../theme";

export function TrainPanel({
  defaultAgent,
  crmSlug,
}: {
  defaultAgent: "randolph" | "maya";
  crmSlug?: string;
}) {
  const desk = useDesk();
  const [agent, setAgent] = useState<"randolph" | "maya" | "both">(defaultAgent);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [specName, setSpecName] = useState("");
  const [specBrief, setSpecBrief] = useState("");
  const visible = desk.training.filter((doc) => agent === "both" || doc.agent === agent || doc.agent === "both");

  async function add() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await saveTraining({ agent, title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setNote("Saved on this phone, and written to Maya's book when the gateway accepts it.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.card}>
        <Text style={styles.h}>Teach the desk</Text>
        <Text style={styles.p}>Randolph and Maya answer from these notes plus the live tables. No outside model is called.</Text>
        <View style={styles.row}>
          {(["randolph", "maya", "both"] as const).map((who) => (
            <Pressable key={who} onPress={() => setAgent(who)} style={[styles.chip, agent === who && styles.chipOn]}>
              <Text style={[styles.chipText, agent === who && styles.chipTextOn]}>{who}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What they should know"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.area]}
          multiline
        />
        <Pressable disabled={busy} onPress={() => void add()} style={styles.button}>
          <Text style={styles.buttonText}>{busy ? "Saving…" : "Add to training"}</Text>
        </Pressable>
        {note ? <Text style={styles.ok}>{note}</Text> : null}
      </View>
      {crmSlug ? (
        <View style={styles.card}>
          <Text style={styles.h}>Add a specialist</Text>
          <Text style={styles.p}>They take this company. Randolph still oversees them.</Text>
          <TextInput value={specName} onChangeText={setSpecName} placeholder="Name" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={specBrief} onChangeText={setSpecBrief} placeholder="What they own" placeholderTextColor={colors.muted} style={[styles.input, styles.area]} multiline />
          <Pressable
            onPress={() => {
              if (!specName.trim() || !specBrief.trim()) return;
              addSpecialist({ id: uid("agent"), name: specName.trim(), crmSlug, brief: specBrief.trim(), createdAt: nowIso() });
              setSpecName("");
              setSpecBrief("");
            }}
            style={styles.ghost}
          >
            <Text style={styles.ghostText}>Assign specialist</Text>
          </Pressable>
          {desk.specialists
            .filter((item) => item.crmSlug === crmSlug)
            .map((item) => (
              <View key={item.id} style={styles.noteRow}>
                <Text style={styles.p}>
                  <Text style={styles.strong}>{item.name}</Text> — {item.brief}
                </Text>
                <Pressable onPress={() => removeSpecialist(item.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
        </View>
      ) : null}
      {visible.map((doc) => (
        <View key={doc.id} style={styles.card}>
          <Text style={styles.kicker}>{doc.agent}</Text>
          <Text style={styles.h}>{doc.title}</Text>
          <Text style={styles.p}>{doc.body}</Text>
          <Pressable onPress={() => void deleteTraining(doc)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {visible.length === 0 ? <Text style={styles.p}>Nothing taught for this choice yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  h: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  p: { fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20 },
  strong: { fontFamily: fonts.bodyMedium, color: colors.ink },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1, textTransform: "uppercase", fontSize: 11 },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 999, backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.ink, textTransform: "capitalize" },
  chipTextOn: { color: colors.cream },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  area: { minHeight: 90, textAlignVertical: "top" },
  button: { backgroundColor: colors.ink, borderRadius: 999, alignItems: "center", paddingVertical: 14 },
  buttonText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  ghost: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, alignItems: "center", paddingVertical: 12 },
  ghostText: { fontFamily: fonts.bodyMedium, color: colors.ink },
  ok: { fontFamily: fonts.body, color: colors.forest },
  remove: { fontFamily: fonts.bodyMedium, color: colors.clay },
  noteRow: { gap: 4 },
});
