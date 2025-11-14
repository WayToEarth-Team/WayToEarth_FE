import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
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
      <View style={styles.content}>
        {/* 로딩 이미지: 화면을 꽉 채우지 않도록 비율 유지 */}
        <Image
          source={require("../assets/WTE-applogo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        {/* 중앙 로딩 인디케이터 */}
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <ActivityIndicator
            style={{ marginTop: 24 }}
            size="small"
            color="#4A90E2"
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
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoContainer: { alignItems: "center", justifyContent: "center" },
  logoImage: { width: width * 0.7, height: height * 0.35 },
});
