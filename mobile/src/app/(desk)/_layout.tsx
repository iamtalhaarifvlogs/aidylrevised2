import { Tabs } from "expo-router";
import { ColorValue, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, TAB_BODY } from "../../theme";

function Icon({ kind, color }: { kind: string; color: ColorValue }) {
  const mark = { backgroundColor: color };
  if (kind === "desk") {
    return (
      <View style={styles.box}>
        <View style={[styles.sq, mark, { left: 1, top: 1 }]} />
        <View style={[styles.sq, mark, { right: 1, top: 1 }]} />
        <View style={[styles.sq, mark, { left: 1, bottom: 1 }]} />
        <View style={[styles.sq, mark, { right: 1, bottom: 1 }]} />
      </View>
    );
  }
  if (kind === "train") {
    return (
      <View style={styles.box}>
        <View style={[styles.book, { borderColor: color }]} />
        <View style={[styles.spine, mark]} />
      </View>
    );
  }
  if (kind === "activity") {
    return (
      <View style={styles.box}>
        <View style={[styles.bar, mark, { width: 16, top: 3 }]} />
        <View style={[styles.bar, mark, { width: 11, top: 10 }]} />
        <View style={[styles.bar, mark, { width: 16, top: 17 }]} />
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <View style={[styles.bell, { borderColor: color }]} />
      <View style={[styles.clapper, mark]} />
    </View>
  );
}

export default function DeskTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      safeAreaInsets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cream,
        tabBarInactiveTintColor: "rgba(247,241,230,0.72)",
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.ink,
          height: TAB_BODY + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 2 },
        tabBarIconStyle: { width: 24, height: 24 },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Desk", tabBarIcon: ({ color }) => <Icon kind="desk" color={color} /> }} />
      <Tabs.Screen name="train" options={{ title: "Train", tabBarIcon: ({ color }) => <Icon kind="train" color={color} /> }} />
      <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: ({ color }) => <Icon kind="activity" color={color} /> }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: ({ color }) => <Icon kind="alerts" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24 },
  sq: { position: "absolute", width: 9, height: 9, borderRadius: 2 },
  book: { position: "absolute", left: 4, top: 2, width: 16, height: 20, borderWidth: 2, borderRadius: 2 },
  spine: { position: "absolute", left: 3, top: 2, width: 3, height: 20, borderRadius: 1 },
  bar: { position: "absolute", left: 3, height: 3, borderRadius: 2 },
  bell: {
    position: "absolute",
    left: 4,
    top: 3,
    width: 16,
    height: 14,
    borderWidth: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  clapper: { position: "absolute", left: 10, top: 18, width: 4, height: 3, borderRadius: 1 },
});
