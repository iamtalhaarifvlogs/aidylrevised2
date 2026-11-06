import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Aidyl Systems",
  slug: "aidyl-systems",
  scheme: "aidyl",
  version: "1.6.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.aidyl.systems",
  },
  android: {
    package: "com.aidyl.systems",
    versionCode: 7,
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.VIBRATE",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.USE_EXACT_ALARM",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.WAKE_LOCK",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    ],
    adaptiveIcon: {
      backgroundColor: "#1c1915",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-sharing",
    "expo-image",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#1c1915",
        image: "./assets/splash-icon.png",
        imageWidth: 180,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#8c6239",
      },
    ],
    "expo-background-task",
  ],
  experiments: process.env.AIDYL_EXPORT_BASE ? { baseUrl: "/phone" } : undefined,
};

export default config;
