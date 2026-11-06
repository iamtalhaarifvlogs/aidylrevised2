import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import { getState, patch, pushNotice } from "./store";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureDeskChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("desk", {
    name: "Aidyl desk",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 80, 180],
    lightColor: "#8c6239",
  });
}

export async function askNotificationPermission(openSettingsIfBlocked = false) {
  if (Platform.OS === "web") return false;
  await ensureDeskChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) {
    if (openSettingsIfBlocked) await Linking.openSettings();
    return false;
  }
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function confirmAlerts() {
  if (Platform.OS === "web") return;
  try {
    await ensureDeskChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Aidyl alerts are on",
        body: "Reminders and desk changes can tap this phone.",
        sound: true,
      },
      trigger: null,
    });
  } catch {
    /* the inbox still collects them */
  }
}

export async function alertsGranted() {
  if (Platform.OS === "web") return true;
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

export async function ping(title: string, body: string) {
  pushNotice({ title, body });
  if (Platform.OS === "web" || !getState().notifyWrites) return;
  try {
    await ensureDeskChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    /* inbox still has it */
  }
}

export async function setMorningBrief(enabled: boolean) {
  patch({ morningBrief: enabled });
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync("aidyl-brief");
  } catch {
    /* none scheduled */
  }
  if (!enabled) return;
  const granted = await askNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: "aidyl-brief",
    content: {
      title: "Aidyl morning book",
      body: "Randolph has the companies ready. Open the desk when you are.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 30,
      channelId: "desk",
    },
  });
}

export async function scheduleNativeAt(id: string, title: string, body: string, when: Date) {
  if (Platform.OS === "web") return false;
  try {
    await ensureDeskChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: "desk" },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelNative(id: string) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* already gone */
  }
}
