import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
} from "react-native";
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

const { width, height } = Dimensions.get("window");

// 러닝 아이콘(이모지) 컴포넌트: 부드러운 상하 바운스 + 살짝 스케일
const RunningIcon = ({ animatedValue }: { animatedValue: Animated.Value }) => {
  const bob = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -4, 0],
  });
  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.98, 1.04, 0.98],
  });
  return (
    <Animated.Text
      style={[
        styles.runningEmoji,
        { transform: [{ translateY: bob }, { scale }] },
      ]}
    >
      🏃
    </Animated.Text>
  );
};

export default function Onboading() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

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

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

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
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.topLine} />
      <View style={styles.content}>
        {/* 장식 아이콘들 (부드러운 플로팅) */}
        <Animated.View
          style={[
            styles.decorativeIcon,
            styles.topLeftIcon,
            {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, -10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.diamond, { backgroundColor: "#FFB800" }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.decorativeIcon,
            styles.topRightIcon,
            {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.circle, { backgroundColor: "#FF6B6B" }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.decorativeIcon,
            styles.bottomIcon,
            {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, -6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.diamond, { backgroundColor: "#4ECDC4" }]} />
        </Animated.View>

        {/* 로고 + 러닝 아이콘 */}
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.textContainer}>
            <Text style={styles.wayText}>WAY</Text>
            <Text style={styles.toText}>TO</Text>
            <Text style={styles.earthText}>EARTH</Text>
          </View>
          <View style={styles.earthIconContainer}>
            <RunningIcon animatedValue={rotateAnim} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  topLine: { height: 2, backgroundColor: "#4A90E2", width: "100%" },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoContainer: { alignItems: "center", justifyContent: "center" },
  textContainer: { alignItems: "center", marginBottom: 20 },
  wayText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2C3E50",
    letterSpacing: 2,
    marginBottom: -2,
  },
  toText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7F8C8D",
    letterSpacing: 4,
    marginBottom: -2,
  },
  earthText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2C3E50",
    letterSpacing: 2,
  },
  earthIconContainer: { position: "absolute", right: -50, top: 10 },
  runningEmoji: { fontSize: 40 },
  decorativeIcon: { position: "absolute" },
  topLeftIcon: { top: height * 0.25, left: width * 0.2 },
  topRightIcon: { top: height * 0.3, right: width * 0.15 },
  bottomIcon: { bottom: height * 0.35, left: width * 0.25 },
  diamond: {
    width: 8,
    height: 8,
    transform: [{ rotate: "45deg" }],
    borderRadius: 1,
  },
  circle: { width: 6, height: 6, borderRadius: 3 },
});
