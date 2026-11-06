import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { askNotificationPermission, confirmAlerts } from "../lib/notify";
import { patch } from "../lib/store";
import { colors, fonts } from "../theme";

const COMPANIES = ["Carshipy", "BetterDealTV", "Associate Logistics"];

export function Splash({ onDone }: { onDone: () => void }) {
  const rise = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.stagger(180, [
      Animated.timing(rise, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(line, { toValue: 1, duration: 700, useNativeDriver: false }),
    ]).start();
  }, [line, rise]);

  async function enter() {
    if (busy) return;
    setBusy(true);
    const granted = await askNotificationPermission(false);
    if (granted) {
      patch({ notifyAsked: true });
      await confirmAlerts();
    }
    onDone();
  }

  return (
    <View style={styles.screen}>
      <Image source={require("../../assets/splash-icon.png")} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.veil} />
      <Animated.View
        style={[
          styles.copy,
          { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
      >
        <Text style={styles.mark}>AS</Text>
        <Text style={styles.brand}>Aidyl</Text>
        <Text style={styles.kicker}>SYSTEMS DESK</Text>
        <Animated.View style={[styles.rule, { width: line.interpolate({ inputRange: [0, 1], outputRange: [0, 72] }) }]} />
        <View style={styles.companies}>
          {COMPANIES.map((name) => (
            <Text key={name} style={styles.company}>
              {name}
            </Text>
          ))}
        </View>
      </Animated.View>
      <Text style={styles.note}>Tap enter. This phone will ask to send reminders and desk alerts.</Text>
      <Pressable onPress={() => void enter()} style={styles.enter} disabled={busy}>
        <Text style={styles.enterText}>{busy ? "Asking…" : "Enter the desk"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, justifyContent: "flex-end" },
  veil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(28,25,21,0.45)" },
  copy: { paddingHorizontal: 28, paddingBottom: 18 },
  mark: { fontFamily: fonts.display, color: colors.brassSoft, fontSize: 18, letterSpacing: 4 },
  brand: { fontFamily: fonts.display, color: colors.cream, fontSize: 72, lineHeight: 76, marginTop: 8 },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brassSoft, letterSpacing: 3, fontSize: 12, marginTop: 8 },
  rule: { height: 2, backgroundColor: colors.brass, marginTop: 18 },
  companies: { marginTop: 18, gap: 4 },
  company: { fontFamily: fonts.body, color: "rgba(247,241,230,0.82)", fontSize: 16 },
  note: {
    marginHorizontal: 28,
    marginBottom: 12,
    fontFamily: fonts.body,
    color: "rgba(247,241,230,0.82)",
    fontSize: 14,
    lineHeight: 20,
  },
  enter: {
    marginHorizontal: 28,
    marginBottom: 36,
    backgroundColor: colors.brass,
    borderRadius: 999,
    alignItems: "center",
    paddingVertical: 16,
  },
  enterText: { fontFamily: fonts.bodyMedium, color: colors.cream, fontSize: 16 },
});
