import "react-native-gesture-handler";
import "../lib/book-watch";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ChatSheet } from "../components/ChatSheet";
import { DeskSignals } from "../components/DeskSignals";
import { SectionNav } from "../components/SectionNav";
import { Splash } from "../components/Splash";
import { syncTraining } from "../lib/data";
import { hydrate, useDesk } from "../lib/store";
import { colors } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const desk = useDesk();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium: require("../../assets/fonts/Fraunces_500Medium.ttf"),
    Fraunces_600SemiBold: require("../../assets/fonts/Fraunces_600SemiBold.ttf"),
    Outfit_400Regular: require("../../assets/fonts/Outfit_400Regular.ttf"),
    Outfit_500Medium: require("../../assets/fonts/Outfit_500Medium.ttf"),
  });
  const [intro, setIntro] = useState(true);
  const ready = (fontsLoaded || !!fontError) && desk.ready;

  useEffect(() => {
    void hydrate().then(() => syncTraining());
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const shell = Platform.OS === "web" ? styles.shell : styles.native;
  const frame = Platform.OS === "web" ? styles.frame : styles.native;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={shell}>
        <View style={frame}>
          {intro ? null : <SectionNav />}
          <View style={styles.stage}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontFamily: "Fraunces_600SemiBold" },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(desk)" options={{ headerShown: false }} />
            <Stack.Screen name="crm/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="reports" options={{ headerShown: false }} />
            <Stack.Screen name="campaigns" options={{ headerShown: false }} />
            <Stack.Screen name="workflow" options={{ headerShown: false }} />
          </Stack>
          {intro ? null : <ChatSheet />}
          {intro ? null : <DeskSignals />}
          </View>
          {intro ? (
            <View style={StyleSheet.absoluteFill}>
              <Splash onDone={() => setIntro(false)} />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  native: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1, backgroundColor: colors.ink, alignItems: "center" },
  frame: { flex: 1, width: "100%", maxWidth: 440, backgroundColor: colors.bg },
  stage: { flex: 1 },
});
