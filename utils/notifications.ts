// utils/notifications.ts
import { Platform, PermissionsAndroid } from "react-native";
import firebase from "@react-native-firebase/app";
import messaging from "@react-native-firebase/messaging";

// Create messaging instance once
const messagingInstance = messaging();

function hasFirebaseDefaultApp(): boolean {
  try {
    // Use modular API (v22+)
    const apps = firebase.apps || [];
    return Array.isArray(apps) && apps.length > 0;
  } catch (e) {
    if (__DEV__) console.warn('[Firebase] Error checking default app:', e);
    return false;
  }
}
// Lazy-load Notifee to avoid crashes on Expo Go or environments
// where the native module is not installed. Use dev client/prebuilt
// for full functionality.
let notifee: any | null = null;
let AndroidImportance: any | null = null;
let EventType: any | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@notifee/react-native");
  notifee = mod?.default ?? mod;
  AndroidImportance = mod?.AndroidImportance ?? null;
  EventType = mod?.EventType ?? null;
} catch {}
import { client } from "@utils/api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigate, navigateToJourneyRun, navigateToLiveRun } from "@navigation/RootNavigation";

/**
 * Firebase FCM 토큰 등록
 * Firebase를 직접 사용 (Expo 서버 안 거침)
 */
export async function registerForPushNotificationsAsync() {
  try {
    // 1. Android 13+ 권한 명시적 요청
    if (Platform.OS === "android" && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (__DEV__) console.log("📱 Android 13+ 알림 권한 결과:", granted);

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        if (__DEV__) console.warn("❌ 알림 권한이 거부되었습니다.");
        return null;
      }
    }

    // 2. Firebase 권한 요청 (iOS용)
    if (!messagingInstance || !hasFirebaseDefaultApp()) {
      if (__DEV__) console.warn("[firebase] messaging unavailable or default app not initialized");
      return null;
    }
    const authStatus = await messagingInstance.requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (__DEV__) console.log("📱 Firebase 알림 권한 상태:", authStatus, "허용:", enabled);

    if (!enabled) {
      if (__DEV__) console.warn("❌ 알림 권한이 거부되었습니다.");
      return null;
    }

    // 3. Android 알림 채널 생성 (Notifee)
    if (Platform.OS === "android" && notifee && AndroidImportance) {
      await notifee.createChannel({
        id: "running_session",
        name: "러닝 세션",
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [300, 500],
        sound: "default",
      });
    }

    // 4. Firebase FCM 토큰 발급
    const token = await messagingInstance.getToken();

    if (__DEV__) console.log("✅ Firebase FCM Token:", token);
    return token;
  } catch (error: any) {
    console.error("❌ Firebase FCM 토큰 발급 실패:", error?.message || error);
    return null;
  }
}

/**
 * FCM 토큰을 백엔드에 등록
 */
export async function sendTokenToServer(fcmToken: string) {
  try {
    const deviceId = `${Platform.OS}-${Date.now()}`;
    const deviceType = Platform.OS === "ios" ? "IOS" : "ANDROID";

    await client.post("/v1/notifications/fcm-token", {
      fcmToken,
      deviceId,
      deviceType,
    });

    if (__DEV__) console.log("✅ FCM 토큰 백엔드 등록 성공");
  } catch (error: any) {
    // 403: 로그인 필요, 조용히 무시
    if (error?.response?.status === 403) {
      if (__DEV__) console.log("⏭️ FCM 토큰 등록 건너뜀 (로그인 필요)");
      return;
    }

    console.error(
      "❌ FCM 토큰 백엔드 등록 실패:",
      error?.response?.data || error?.message || error
    );
  }
}

/**
 * FCM 토큰 비활성화 (로그아웃 시)
 */
export async function deactivateToken() {
  try {
    const deviceId = `${Platform.OS}-${Date.now()}`;

    await client.delete(`/v1/notifications/fcm-token/${deviceId}`);

    // Firebase 토큰 삭제
    await messagingInstance.deleteToken();

    if (__DEV__) console.log("✅ FCM 토큰 비활성화 성공");
  } catch (error: any) {
    console.error(
      "❌ FCM 토큰 비활성화 실패:",
      error?.response?.data || error?.message || error
    );

    // 로그아웃은 계속 진행되도록 에러를 throw 하지 않음
  }
}

/**
 * Firebase 알림 리스너 설정
 */
export function setupNotificationListeners() {
  // 1. 포그라운드 메시지 수신 (앱이 켜져 있을 때)
  if (!messagingInstance || !hasFirebaseDefaultApp()) {
    // Return no-op cleanup if messaging is unavailable
    return () => {};
  }
  const unsubscribeForeground = messagingInstance.onMessage(async (remoteMessage: any) => {
    if (__DEV__) console.log("📩 포그라운드 알림 수신:", remoteMessage);

    // Notifee로 로컬 알림 표시
    if (remoteMessage.notification && notifee) {
      await notifee.displayNotification({
        title: remoteMessage.notification.title || "Way to Earth",
        body: remoteMessage.notification.body || "",
        data: remoteMessage.data,
        android: {
          channelId: "running_session",
          smallIcon: "ic_launcher",
          color: "#10b981",
          pressAction: {
            id: "default",
          },
        },
        ios: {
          sound: "default",
        },
      });
    }
  });

  // 2. 알림 탭 이벤트 (앱이 백그라운드/종료 상태에서 알림 탭)
  const unsubscribeNotificationOpened = messagingInstance.onNotificationOpenedApp(
    (remoteMessage: any) => {
      if (__DEV__) console.log("📱 알림 탭으로 앱 열림:", remoteMessage);
      // 필요한 화면으로 네비게이션
      // 예: navigation.navigate('TargetScreen', remoteMessage.data);
    }
  );

  // 3. 앱이 종료된 상태에서 알림을 탭해서 열었는지 확인
  messagingInstance
    .getInitialNotification()
    .then((remoteMessage: any) => {
      if (remoteMessage) {
        if (__DEV__) console.log("🚀 종료 상태에서 알림으로 앱 시작:", remoteMessage);
        // 필요한 화면으로 네비게이션
      }
    });

  // 4. Notifee 알림 탭 이벤트
  if (notifee?.onForegroundEvent && EventType) {
    notifee.onForegroundEvent(async ({ type, detail }: any) => {
      // PRESS, ACTION_PRESS 만 처리하고, DELIVERED 등은 로그 억제
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        try {
          const raw = await AsyncStorage.getItem("@running_session");
          if (raw) {
            const session = JSON.parse(raw);
            if (session?.type === 'journey') navigateToJourneyRun();
            else navigateToLiveRun();
          } else {
            navigateToLiveRun();
          }
        } catch {}
      }
    });
  }

  // Cleanup 함수
  return () => {
    unsubscribeForeground();
    unsubscribeNotificationOpened();
  };
}

/**
 * FCM 토큰 갱신 리스너
 */
export function setupTokenRefreshListener() {
  if (!messagingInstance || !hasFirebaseDefaultApp()) {
    return () => {};
  }
  return messagingInstance.onTokenRefresh(async (newToken: string) => {
    if (__DEV__) console.log("🔄 FCM 토큰 갱신됨:", newToken);
    await sendTokenToServer(newToken);
  });
}

/**
 * 백그라운드 메시지 핸들러
 * index.js 최상단에서 호출해야 함
 */
export function setupBackgroundMessageHandler() {
  if (!messagingInstance || !hasFirebaseDefaultApp()) return;
  messagingInstance.setBackgroundMessageHandler(async (remoteMessage: any) => {
    if (__DEV__) console.log("📬 백그라운드 메시지 수신:", remoteMessage);

    // 백그라운드에서도 Notifee로 알림 표시
    if (remoteMessage.notification && notifee) {
      await notifee.displayNotification({
        title: remoteMessage.notification.title || "Way to Earth",
        body: remoteMessage.notification.body || "",
        data: remoteMessage.data,
        android: {
          channelId: "running_session",
          smallIcon: "ic_launcher",
          color: "#10b981",
        },
      });
    }
  });
}
