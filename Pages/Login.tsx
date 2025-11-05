// screens/WayToEarthOnboarding.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StatusBar, StyleSheet, Dimensions, ActivityIndicator, NativeModules } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import KakaoLoginButton from "../components/KakaoLoginButton";
import RunningManIcon from "../components/Running/RunningManIcon";
import useKakaoLogin from "../hooks/useKakaoLogin";
import { ensureAccessToken } from "../utils/auth/tokenManager";
import { getMyProfile } from "../utils/api/users";
import { useNavigation } from "@react-navigation/native";
import {
  registerForPushNotificationsAsync,
  sendTokenToServer,
} from "../utils/notifications";

const { height } = Dimensions.get("window");

export default function WayToEarthOnboarding() {
  const handleKakaoLogin = useKakaoLogin();
  const navigation = useNavigation<any>();
  const [checking, setChecking] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [logText, setLogText] = useState("");

  // 🔑 Dev 환경에서 한 번만 카카오 키해시 표시 (카카오 콘솔에 등록용)
  useEffect(() => {
    // 자동 로그인: 토큰 보유 + 프로필 조회 성공 시 러닝 화면으로 즉시 이동
    (async () => {
      try {
        const token = await ensureAccessToken();
        if (token) {
          await getMyProfile();

          // FCM 토큰 등록
          const fcmToken = await registerForPushNotificationsAsync();
          if (fcmToken) {
            await sendTokenToServer(fcmToken);
          }

          navigation.reset({
            index: 0,
            routes: [{ name: "MainTabs", params: { screen: "LiveRunningScreen" } }],
          });
          return;
        }
      } catch (e) {
        // 토큰 없음/만료 → 버튼 노출
      } finally {
        setChecking(false);
      }
    })();

    // 개발 편의: 키해시 로그(선택)
    (async () => {
      try {
        const hash = await (NativeModules as any)?.RNKakaoLogins?.getKeyHash?.();
        if (__DEV__ && hash) console.log("Kakao KeyHash:", hash);
      } catch {}
    })();
  }, [navigation]);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.content}>
        {checking ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#666", marginBottom: 12 }}>자동 로그인 확인중…</Text>
          </View>
        ) : (
          <>
        <View style={styles.textContainer}>
          <Text style={styles.mainTitle}>Way to Earth로</Text>
          <Text style={styles.subTitle}>
            <Text style={styles.highlight}>러닝</Text>을 재미있게
          </Text>
        </View>

        <View style={styles.illustrationContainer}>
          <RunningManIcon />
        </View>

        <View style={styles.buttonContainer}>
          <KakaoLoginButton
            onPress={async () => {
              try {
                if (__DEV__) console.log("🔥 [TEST] 카카오 로그인 버튼 클릭됨");
                setLogText("카카오 로그인 중…");
                setLoginLoading(true);
                await handleKakaoLogin();
                setLogText("");
              } catch (e) {
                setLogText("로그인 실패");
              } finally {
                setLoginLoading(false);
              }
            }}
          />

          {/* 상태 메시지 */}
          <View style={{ alignItems: "center", marginTop: 20 }}>
            {loginLoading ? (
              <ActivityIndicator size="small" color="#4A90E2" />
            ) : (
              <Text style={{ color: "#666", fontSize: 12 }}>{logText}</Text>
            )}
          </View>
        </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: height * 0.15,
    paddingBottom: 50,
  },
  textContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 8,
    textAlign: "center",
  },
  subTitle: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  highlight: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4A90E2",
    textAlign: "center",
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 60,
  },
  buttonContainer: {
    paddingHorizontal: 4,
  },
});
