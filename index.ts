import 'react-native-gesture-handler';
import { registerRootComponent } from "expo";
import firebase from "@react-native-firebase/app"; // Firebase App 초기화 (messaging보다 먼저 import 필수)
import messaging from "@react-native-firebase/messaging";

// Firebase 명시적 초기화 확인 및 messaging 인스턴스 생성
const messagingInstance = messaging();

if (__DEV__) {
  const apps = firebase.apps || [];
  console.log("🔥 Firebase Apps:", apps.length);
  if (apps.length > 0) {
    console.log("🔥 Firebase initialized");
  } else {
    console.warn("⚠️ Firebase not initialized!");
  }
}
// Lazy-load notifee so Expo Go / missing native module doesn't crash
let notifee: any | null = null;
let AndroidImportance: any | undefined;
let EventType: any | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@notifee/react-native");
  notifee = mod?.default ?? mod;
  AndroidImportance = mod?.AndroidImportance;
  EventType = mod?.EventType;
} catch {}
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "@navigation/RootNavigation";
// Ensure background location task is registered at startup
import "./utils/backgroundLocation";
import App from "./App";
import { migrateLegacyTokens, logStorageBackendOnce } from "@utils/auth/tokenManager";

// FCM 백그라운드 메시지 핸들러 (앱 시작 전 등록 필수)
messagingInstance.setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("📬 백그라운드 메시지 수신:", remoteMessage);

  // Notifee로 백그라운드 알림 표시
  const hasNotification = !!remoteMessage.notification;
  const hasData =
    !!remoteMessage.data &&
    (remoteMessage.data.title || remoteMessage.data.body);
  if ((hasNotification || hasData) && notifee && AndroidImportance) {
    try {
      await notifee.createChannel({
        id: "running_session",
        name: "러닝 세션",
        importance: AndroidImportance.HIGH,
        sound: "default",
      });
      await notifee.displayNotification({
        title:
          remoteMessage.notification?.title ||
          (remoteMessage.data?.title as string) ||
          "Way to Earth",
        body:
          remoteMessage.notification?.body ||
          (remoteMessage.data?.body as string) ||
          "",
        data: remoteMessage.data,
        android: {
          channelId: "running_session",
          smallIcon: "ic_launcher",
          color: "#10b981",
          pressAction: { id: "default", launchActivity: "default" },
        },
      });
    } catch {}
  }
});

// Migrate legacy tokens into secure strategy at startup (fire-and-forget)
try { migrateLegacyTokens(); } catch {}
try { logStorageBackendOnce(); } catch {}

// 앱 시작 시 오래된 러닝 세션 자동 정리 (비정상 종료 대응)
(async () => {
  try {
    const raw = await AsyncStorage.getItem("@running_session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.isRunning && session?.startTime) {
        const elapsed = Date.now() - session.startTime;
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        if (elapsed > SIX_HOURS) {
          console.log("[index] Clearing stale running session on app start");
          await AsyncStorage.removeItem("@running_session");
        }
      }
    }
  } catch {}
})();

registerRootComponent(App);
// Android foreground service registration for Notifee (required for asForegroundService)
if (Platform.OS === "android" && notifee) {
  try {
    // Pre-create notification channels to avoid delays before foreground service starts
    (async () => {
      try {
        await notifee.createChannel({
          id: "running_session_ongoing",
          name: "러닝 진행(무음)",
          importance: AndroidImportance?.DEFAULT,
          vibration: false,
        });
        await notifee.createChannel({
          id: "running_session_popup",
          name: "러닝 시작 알림",
          importance: AndroidImportance?.HIGH,
          vibration: true,
          sound: "default",
        });
      } catch {}
    })();

    notifee.registerForegroundService(() => {
      // Keep the service alive until stopForegroundService() is called
      return new Promise(() => {});
    });
  } catch (e) {
    // no-op
  }

  // Optional: handle background notification events to avoid warnings
  try {
    notifee.onBackgroundEvent?.(async ({ type, detail }: any) => {
      // Only act on presses; ignore delivered updates
      if (type === EventType?.PRESS || type === EventType?.ACTION_PRESS) {
        try {
          // Decide target from saved running session
          const raw = await AsyncStorage.getItem("@running_session");
          let target: "live" | "journey" = "live";
          if (raw) {
            const session = JSON.parse(raw);
            if (session?.type === "journey") target = "journey";
          }

          // If navigation is ready, navigate immediately; otherwise save pending target
          if ((navigationRef as any).isReady?.()) {
            if (target === "journey") {
              (navigationRef as any).navigate("JourneyRunningScreen");
            } else {
              (navigationRef as any).navigate("MainTabs", { screen: "LiveRunningScreen" });
            }
          } else {
            await AsyncStorage.setItem(
              "@pending_nav",
              JSON.stringify({ target, params: {} })
            );
          }
        } catch {}
      }
    });
  } catch {}
}
