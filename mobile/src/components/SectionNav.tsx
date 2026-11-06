import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../theme";

const LINKS: { href: string; label: string; on: (path: string) => boolean }[] = [
  { href: "/", label: "Command", on: (path) => path === "/" || path === "/index" },
  { href: "/crm/carshipy", label: "Carshipy", on: (path) => /carshipy|ogamoto/.test(path) },
  { href: "/crm/betterdealtv", label: "BetterDealTV", on: (path) => path.includes("betterdealtv") },
  { href: "/crm/associate-logistics", label: "Logistics", on: (path) => path.includes("associate-logistics") },
  { href: "/reports", label: "Reports", on: (path) => path.startsWith("/reports") },
  { href: "/campaigns", label: "Campaigns", on: (path) => path.startsWith("/campaigns") },
  { href: "/workflow", label: "Workflow", on: (path) => path.startsWith("/workflow") },
  { href: "/activity", label: "Activity", on: (path) => path.startsWith("/activity") },
  { href: "/alerts", label: "Alerts", on: (path) => path.startsWith("/alerts") },
  { href: "/train", label: "Train", on: (path) => path.startsWith("/train") },
];

export function SectionNav() {
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {LINKS.map((link) => {
          const active = link.on(path);
          return (
            <Pressable
              key={link.href}
              onPress={() => router.push(link.href as never)}
              style={[styles.chip, active && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.label, active && styles.labelOn]}>{link.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.ink },
  row: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, alignItems: "center" },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(247,241,230,0.08)" },
  chipOn: { backgroundColor: colors.brass },
  label: { fontFamily: fonts.bodyMedium, color: "rgba(247,241,230,0.78)", fontSize: 13 },
  labelOn: { color: colors.cream },
});
