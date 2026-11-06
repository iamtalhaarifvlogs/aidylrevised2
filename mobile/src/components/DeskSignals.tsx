import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { startDeskSignals } from "../lib/reminders";
import { useDesk } from "../lib/store";
import { colors, fonts } from "../theme";

export function DeskSignals() {
  const latest = useDesk().notices[0];
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => startDeskSignals(), []);

  useEffect(() => {
    if (!latest) return;
    setShown(latest.id);
    const timer = setTimeout(() => setShown((id) => (id === latest.id ? null : id)), 6500);
    return () => clearTimeout(timer);
  }, [latest]);

  if (!latest || shown !== latest.id) return null;
  return (
    <View pointerEvents="none" style={styles.toast}>
      <Text style={styles.kicker}>{latest.title}</Text>
      <Text style={styles.body}>{latest.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 40,
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  kicker: { fontFamily: fonts.bodyMedium, color: colors.brass, letterSpacing: 1.1, fontSize: 11 },
  body: { fontFamily: fonts.body, color: colors.cream, lineHeight: 20 },
});
