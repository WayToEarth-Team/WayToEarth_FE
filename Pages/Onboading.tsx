import React, { useEffect, useRef } from "react";
import { View, StyleSheet, StatusBar, Animated, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ensureAccessToken } from "../utils/auth/tokenManager";
import { getMyProfile } from "../utils/api/users";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  registerForPushNotificationsAsync,
  sendTokenToServer,
} from "../utils/notifications";

export default function Onboading() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  type Navigation = NativeStackNavigationProp<RootStackParamList, "Onboarding">;
  const navigation = useNavigation<Navigation>();

  useEffect(() => {
    // 공통 애니메이션은 항상 시작 (로그인 유무와 무관)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // 배경 이미지는 풀스크린로 페이드만 적용

    // 자동 로그인: 있어도 최소 3초는 로딩 유지
    let navTimer: NodeJS.Timeout | null = null;
    const startAt = Date.now();
    (async () => {
      try {
        const token = await ensureAccessToken();
        if (token) {
          await getMyProfile();
          const fcmToken = await registerForPushNotificationsAsync();
          if (fcmToken) await sendTokenToServer(fcmToken);
          const remain = Math.max(0, 3000 - (Date.now() - startAt));
          navTimer = setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [
                { name: "MainTabs", params: { screen: "LiveRunningScreen" } },
              ],
            });
          }, remain);
          return;
        }
      } catch {}
      // 미로그인: 2초 후 Login 이동(현행 유지)
      navTimer = setTimeout(() => navigation.navigate("Login" as never), 2000);
    })();

    return () => {
      if (navTimer) clearTimeout(navTimer);
    };
  }, []);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.content}>
        {/* 원본 비율 유지: 화면에 맞춰 전체 표시 (크롭 없음) */}
        <Animated.View style={[styles.flexFill, { opacity: fadeAnim }]}>
          <Image
            source={require("../assets/images/WTE-AppLogo.png")}
            style={styles.imageContain}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  content: {
    flex: 1,
    position: "relative",
  },
  logoContainer: { alignItems: "center", justifyContent: "center" },
  flexFill: { flex: 1 },
  imageContain: { width: "100%", height: "100%" },
});
