import { Platform, Alert } from "react-native";

// Lazy import to avoid requiring Android-only module on iOS
let ToastAndroid: any | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ToastAndroid = require("react-native").ToastAndroid;
} catch {}

export function showToast(message: string) {
  if (Platform.OS === "android" && ToastAndroid) {
    try {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    } catch {}
  }
  try {
    Alert.alert("알림", message);
  } catch {
    // noop
  }
}

