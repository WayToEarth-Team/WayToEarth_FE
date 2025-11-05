import { registerRootComponent } from "expo";
import messaging from "@react-native-firebase/messaging";
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
import { navigationRef } from "./navigation/RootNavigation";
// Ensure background location task is registered at startup
import "./utils/backgroundLocation";
import App from "./App";
import { migrateLegacyTokens, logStorageBackendOnce } from "./utils/auth/tokenManager";

// FCM 백그라운드 메시지 핸들러 (앱 시작 전 등록 필수)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
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
          if (navigationRef.isReady()) {
            if (target === "journey") {
              navigationRef.navigate("JourneyRunningScreen" as never);
            } else {
              navigationRef.navigate(
                "MainTabs" as never,
                { screen: "LiveRunningScreen" } as never
              );
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
