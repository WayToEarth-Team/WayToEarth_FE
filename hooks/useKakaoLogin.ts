// hooks/useKakaoLogin.ts
import { useCallback } from "react";
import { Alert, Platform, NativeModules } from "react-native";
import { kakaoLoginWithSDK } from "@utils/api/auth";
import { setTokens } from "@utils/auth/tokenManager";
import { useNavigation } from "@react-navigation/native";
import {
  registerForPushNotificationsAsync,
  sendTokenToServer,
} from "@utils/notifications";

type RNKakao = {
  isKakaoTalkLoginAvailable?: () => Promise<boolean>;
  isKakaoTalkInstalled?: () => Promise<boolean>;
  login: () => Promise<{ accessToken: string }>;
  loginWithKakaoAccount: () => Promise<{ accessToken: string }>;
  logout: () => Promise<void>;
  getKeyHash?: () => Promise<string>; // 👈 추가
};

export default function useKakaoLogin() {
  const navigation = useNavigation<any>();

  return useCallback(async () => {
    try {
      const Kakao = NativeModules.RNKakaoLogins as RNKakao | undefined;

      if (
        !Kakao ||
        typeof Kakao.login !== "function" ||
        typeof Kakao.loginWithKakaoAccount !== "function"
      ) {
        throw new Error(
          Platform.select({
            android:
              "Kakao SDK 네이티브 모듈을 불러오지 못했습니다. 개발 빌드(APK) 재설치 후 다시 실행하세요.",
            ios: "Kakao SDK 네이티브 모듈이 로드되지 않았습니다. 개발 빌드에서 실행하세요.",
            default: "지원되지 않는 플랫폼입니다.",
          })!
        );
      }

      // ✅ 키해시 한 번 표시 (필요 없으면 주석 처리)
      if (typeof Kakao.getKeyHash === "function") {
        const hash = await Kakao.getKeyHash();
        Alert.alert("Kakao KeyHash", hash); // 이 값을 카카오 콘솔에 등록
        console.log("Kakao KeyHash:", hash);
      }

      // 설치/가용 여부
      const talkAvailable =
        (typeof Kakao.isKakaoTalkLoginAvailable === "function"
          ? await Kakao.isKakaoTalkLoginAvailable()
          : typeof Kakao.isKakaoTalkInstalled === "function"
          ? await Kakao.isKakaoTalkInstalled()
          : false) || false;

      const { accessToken } = talkAvailable
        ? await Kakao.login()
        : await Kakao.loginWithKakaoAccount();

      const { accessToken: serverAccessToken, refreshToken: serverRefreshToken, isOnboardingCompleted } = await kakaoLoginWithSDK(
        accessToken
      );

      if (!serverAccessToken) throw new Error("서버에서 액세스 토큰을 받지 못했습니다.");
      await setTokens(String(serverAccessToken), serverRefreshToken ?? null);

      // FCM 토큰 등록
      const fcmToken = await registerForPushNotificationsAsync();
      if (fcmToken) {
        await sendTokenToServer(fcmToken);
      }

      // ✅ 라우팅: 이미 회원가입 완료 → 러닝 화면, 미완료 → Register
      if (isOnboardingCompleted) {
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs", params: { screen: "LiveRunningScreen" } }],
        });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Register" }] });
      }
    } catch (e: any) {
      const detail = e?.response?.data ? JSON.stringify(e.response.data) : e?.message;
      console.log("Kakao login error →", e, e?.code, e?.message, detail);
      Alert.alert(
        "카카오 로그인 실패",
        [e?.code, e?.message, detail].filter(Boolean).join(" ")
      );
      try {
        const Kakao = NativeModules.RNKakaoLogins as RNKakao | undefined;
        await Kakao?.logout?.();
      } catch {}
    }
  }, [navigation]);
}
