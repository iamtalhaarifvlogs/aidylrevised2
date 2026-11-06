import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { respond, type Persona } from "../lib/engine";
import { crmBySlug, saveTraining } from "../lib/data";
import { clearThread, getState, pushMessage, setMind, useDesk, type DeskState } from "../lib/store";
import type { ChatMessage, Specialist } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { colors, fonts, TAB_BODY } from "../theme";
import { TypeText } from "./TypeText";

function personaFor(path: string, choice: "desk" | "chief", specialists: Specialist[]): Persona {
  const match = path.match(/crm\/([^/]+)/);
  const slug = match?.[1] === "ogamoto" ? "carshipy" : match?.[1];
  if (!slug || choice === "chief") return { id: "randolph", name: "Randolph", kind: "randolph", scope: "*" };
  if (slug === "carshipy") return { id: "maya", name: "Maya", kind: "maya", scope: "carshipy" };
  const spec = specialists.find((item) => item.crmSlug === slug);
  if (spec) {
    return {
      id: `specialist:${spec.id}`,
      name: spec.name,
      kind: "specialist",
      scope: spec.crmSlug,
      brief: spec.brief,
      specialist: spec,
    };
  }
  return { id: "randolph", name: "Randolph", kind: "randolph", scope: "*" };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      const screenH = Dimensions.get("screen").height;
      const windowH = Dimensions.get("window").height;
      const keyboardH = Math.max(0, screenH - event.endCoordinates.screenY);
      const resized = windowH < screenH - keyboardH + 48;
      setOverlap(resized ? 0 : keyboardH);
    });
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return overlap;
}

export function ChatSheet() {
  const path = usePathname();
  const desk = useDesk();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"desk" | "chief">("desk");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [teach, setTeach] = useState(false);
  const [lesson, setLesson] = useState("");
  const [liveId, setLiveId] = useState("");
  const scroller = useRef<ScrollView>(null);
  const overlap = useKeyboardOverlap();
  const persona = personaFor(path, choice, desk.specialists);
  const thread = desk.threads[persona.id] ?? [];
  const crmMatch = path.match(/crm\/([^/]+)/);
  const crm = crmMatch?.[1] ?? "*";

  useEffect(() => {
    setChoice("desk");
  }, [path]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [thread.length, thinking, open, overlap]);

  async function teachNow() {
    const body = lesson.trim();
    if (body.length < 8) return;
    const agent = persona.kind === "maya" ? "maya" : "randolph";
    await saveTraining({ agent, title: body.split(/[.!?]/)[0].slice(0, 80), body });
    setLesson("");
    setTeach(false);
    const message: ChatMessage = {
      id: uid("msg"),
      role: "agent",
      agent: persona.name,
      text: "Got it. I'll keep that, and I'll use it the next time it fits.",
      at: nowIso(),
    };
    setLiveId(message.id);
    pushMessage(persona.id, message);
  }

  async function send(raw?: string) {
    const value = (raw ?? text).trim();
    if (!value || busy) return;
    setText("");
    setTeach(false);
    pushMessage(persona.id, { id: uid("msg"), role: "user", text: value, at: nowIso() });
    setBusy(true);
    setThinking(true);
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    try {
      const state: DeskState = getState();
      const turn = await respond({
        persona,
        text: value,
        crm: persona.scope === "*" ? crm : persona.scope,
        mind: state.minds[persona.id] ?? {},
        operator: state.operatorName || "Admin",
        training: state.training,
      });
      setMind(persona.id, turn.mind);
      const words = turn.text.split(/\s+/).filter(Boolean).length;
      await wait(Math.min(1100, 520 + Math.min(words, 24) * 12));
      setThinking(false);
      const id = uid("msg");
      setLiveId(id);
      pushMessage(persona.id, { id, role: "agent", agent: persona.name, text: turn.text, at: nowIso() });
      await wait(Math.min(4200, 400 + turn.text.length * 18));
      if (turn.aether) {
        const aid = uid("msg");
        setLiveId(aid);
        pushMessage(persona.id, { id: aid, role: "aether", agent: "Aether", text: turn.aether, at: nowIso() });
      }
      if (turn.peer) {
        const pid = uid("msg");
        setLiveId(pid);
        pushMessage(persona.id, { id: pid, role: "peer", agent: turn.peer.name, text: turn.peer.text, at: nowIso() });
      }
    } catch (error) {
      setThinking(false);
      pushMessage(persona.id, {
        id: uid("msg"),
        role: "agent",
        agent: persona.name,
        text: error instanceof Error ? error.message : "I hit a problem reading the desk.",
        at: nowIso(),
      });
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  const prompts =
    persona.kind === "maya"
      ? ["Where are reports?", "How is the pipeline?", "Draft a Nigeria campaign: never pay before the lane is named"]
      : ["Where do I find reports?", "Write a campaign for people shipping cars to Nigeria. Tell them not to pay before the vehicle and the lane are named.", "How is BetterdealTV doing?"];

  const onTabs = path === "/" || path === "/index" || path === "/train" || path === "/activity" || path === "/alerts";
  const dock = onTabs ? TAB_BODY + insets.bottom : Math.max(insets.bottom, 12);
  const sheetBottom = Math.max(dock, overlap);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { top: insets.top + 8, bottom: sheetBottom }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{persona.name}</Text>
                <Text style={styles.meta}>{crm === "*" ? "Master desk" : crmBySlug(crm)?.name ?? "Desk"} · Aether writes</Text>
              </View>
              <Pressable onPress={() => clearThread(persona.id)} style={styles.headBtn}>
                <Text style={styles.headBtnText}>Clear</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} style={styles.headBtn} accessibilityLabel="Close chat">
                <Text style={styles.headBtnText}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.tools}>
              {crm !== "*" ? (
                <Pressable onPress={() => setChoice(choice === "desk" ? "chief" : "desk")} style={styles.chip}>
                  <Text style={styles.chipText}>{choice === "desk" ? "This desk" : "Randolph"}</Text>
                </Pressable>
              ) : (
                <Text style={styles.hint}>Talk like a colleague.</Text>
              )}
              <Pressable onPress={() => setTeach((value) => !value)} style={[styles.chip, teach && styles.chipOn]}>
                <Text style={[styles.chipText, teach && styles.chipTextOn]}>Train</Text>
              </Pressable>
            </View>
            {teach ? (
              <View style={styles.teach}>
                <TextInput
                  value={lesson}
                  onChangeText={setLesson}
                  placeholder="Write one rule they should remember."
                  placeholderTextColor={colors.muted}
                  style={styles.lesson}
                  multiline
                />
                <Pressable onPress={() => void teachNow()} style={styles.send}>
                  <Text style={styles.sendText}>Save lesson</Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              ref={scroller}
              style={styles.thread}
              contentContainerStyle={{ gap: 10, padding: 12, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {thread.length === 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={styles.bubble}>
                    {persona.kind === "maya"
                      ? "Hey. I'm Maya. We can just talk, or look at a Carshipy buyer."
                      : `Hello. I'm ${persona.name}. Happy to talk, or to walk the companies.`}
                  </Text>
                  <View style={styles.prompts}>
                    {prompts.map((prompt) => (
                      <Pressable key={prompt} onPress={() => void send(prompt)} style={styles.prompt}>
                        <Text style={styles.promptText}>{prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {thread.map((message) => (
                <Message key={message.id} message={message} play={message.id === liveId} />
              ))}
              {thinking ? <Text style={styles.thinking}>{persona.name} is writing…</Text> : null}
            </ScrollView>
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={`Message ${persona.name}`}
                placeholderTextColor={colors.muted}
                style={styles.input}
                multiline
              />
              <Pressable disabled={busy || !text.trim()} onPress={() => void send()} style={[styles.send, (busy || !text.trim()) && styles.sendOff]}>
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.fab, { bottom: dock + 12 }]}
          accessibilityLabel={`Open chat with ${persona.name}`}
        >
          <Text style={styles.fabLetter}>{persona.name.slice(0, 1)}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Message({ message, play }: { message: ChatMessage; play: boolean }) {
  if (message.role === "user") {
    return (
      <View style={styles.user}>
        <Text style={styles.userText}>{message.text}</Text>
      </View>
    );
  }
  if (message.role === "aether") {
    return (
      <View style={styles.aether}>
        <Text style={styles.aetherText}>
          Aether · <TypeText text={message.text} play={play} />
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.agent}>
      <Text style={styles.who}>{message.agent}</Text>
      <Text style={styles.agentText}>
        <TypeText text={message.text} play={play} />
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(28,25,21,0.28)" },
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  head: {
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: { fontFamily: fonts.display, color: colors.cream, fontSize: 26 },
  meta: { fontFamily: fonts.body, color: "rgba(247,241,230,0.7)", fontSize: 12, marginTop: 2 },
  headBtn: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(247,241,230,0.35)", paddingHorizontal: 12, paddingVertical: 8 },
  headBtnText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 13 },
  tools: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  hint: { fontFamily: fonts.body, color: colors.muted, fontSize: 13 },
  chip: { backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brass },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12 },
  chipTextOn: { color: colors.cream },
  teach: { paddingHorizontal: 12, gap: 8 },
  lesson: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    padding: 12,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  thread: { flex: 1, backgroundColor: colors.bg },
  bubble: { fontFamily: fonts.body, color: colors.ink, backgroundColor: colors.paper, borderRadius: 16, padding: 12 },
  prompts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prompt: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  promptText: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
  thinking: { fontFamily: fonts.body, color: colors.muted, fontSize: 12 },
  composer: { flexDirection: "row", gap: 8, padding: 12, alignItems: "flex-end", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  send: { backgroundColor: colors.brass, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  sendOff: { opacity: 0.45 },
  sendText: { fontFamily: fonts.bodyMedium, color: colors.cream },
  user: { alignSelf: "flex-end", maxWidth: "86%", backgroundColor: colors.brass, borderRadius: 16, padding: 12 },
  userText: { fontFamily: fonts.body, color: colors.cream },
  agent: { alignSelf: "flex-start", maxWidth: "90%", backgroundColor: colors.paper, borderRadius: 16, padding: 12 },
  agentText: { fontFamily: fonts.body, color: colors.ink },
  who: { fontFamily: fonts.bodyMedium, color: colors.brass, fontSize: 11, marginBottom: 4 },
  aether: { backgroundColor: colors.forestSoft, borderRadius: 16, padding: 12 },
  aetherText: { fontFamily: fonts.body, color: colors.forest, fontSize: 12 },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brass,
    alignItems: "center",
    justifyContent: "center",
  },
  fabLetter: { fontFamily: fonts.display, color: colors.cream, fontSize: 22 },
});
