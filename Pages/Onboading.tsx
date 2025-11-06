import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, StatusBar, Animated, Dimensions } from "react-native";
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

// 지구본 아이콘 컴포넌트
const EarthIcon = ({ animatedValue }: { animatedValue: Animated.Value }) => {
  const rotateValue = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={[styles.earthContainer, { transform: [{ rotate: rotateValue }] }]}
    >
      <View style={styles.earthBase}>
        {/* 대륙 모양들 */}
        <View style={[styles.continent, styles.continent1]} />
        <View style={[styles.continent, styles.continent2]} />
        <View style={[styles.continent, styles.continent3]} />
        <View style={[styles.continent, styles.continent4]} />
      </View>
    </Animated.View>
  );
};

// 작은 장식 아이콘들
const DecorativeIcons = ({
  animatedValue,
}: {
  animatedValue: Animated.Value;
}) => {
  const floatAnimation1 = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -10, 0],
  });

  const floatAnimation2 = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 8, 0],
  });

  const floatAnimation3 = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -6, 0],
  });

  return (
    <>
      {/* 상단 왼쪽 다이아몬드 */}
      <Animated.View
        style={[
          styles.decorativeIcon,
          styles.topLeftIcon,
          { transform: [{ translateY: floatAnimation1 }] },
        ]}
      >
        <View style={[styles.diamond, { backgroundColor: "#FFB800" }]} />
      </Animated.View>

      {/* 상단 오른쪽 원 */}
      <Animated.View
        style={[
          styles.decorativeIcon,
          styles.topRightIcon,
          { transform: [{ translateY: floatAnimation2 }] },
        ]}
      >
        <View style={[styles.circle, { backgroundColor: "#FF6B6B" }]} />
      </Animated.View>

      {/* 하단 다이아몬드 */}
      <Animated.View
        style={[
          styles.decorativeIcon,
          styles.bottomIcon,
          { transform: [{ translateY: floatAnimation3 }] },
        ]}
      >
        <View style={[styles.diamond, { backgroundColor: "#4ECDC4" }]} />
      </Animated.View>
    </>
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
    // 1) 자동 로그인 체크: 토큰이 있고 프로필 조회 성공이면 러닝 화면으로 즉시 이동
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
          return; // 바로 종료
        }
      } catch (e) {
        // 토큰 없음/실패 시 아래 애니메이션 + Login 이동 로직 수행
      }
      // 토큰이 없거나 실패하면 기존 애니메이션 시퀀스와 함께 진행
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

      // ✅ 2초 후 로그인 화면으로 이동
      const timer = setTimeout(() => {
        navigation.navigate("Login");
      }, 2000);
      return () => clearTimeout(timer);
    })();
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.topLine} />
      <View style={styles.content}>
        <DecorativeIcons animatedValue={floatAnim} />
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.textContainer}>
            <Text style={styles.wayText}>WAY</Text>
            <Text style={styles.toText}>TO</Text>
            <Text style={styles.earthText}>EARTH</Text>
          </View>
          <View style={styles.earthIconContainer}>
            <EarthIcon animatedValue={rotateAnim} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topLine: {
    height: 2,
    backgroundColor: "#4A90E2",
    width: "100%",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
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
  earthIconContainer: {
    position: "absolute",
    right: -50,
    top: 10,
  },
  earthContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  earthBase: {
    width: 32,
    height: 32,
    backgroundColor: "#3498DB",
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
  },
  continent: {
    position: "absolute",
    backgroundColor: "#27AE60",
    borderRadius: 2,
  },
  continent1: {
    width: 8,
    height: 6,
    top: 4,
    left: 6,
    borderRadius: 3,
  },
  continent2: {
    width: 6,
    height: 4,
    top: 12,
    left: 4,
    borderRadius: 2,
  },
  continent3: {
    width: 5,
    height: 8,
    top: 8,
    right: 5,
    borderRadius: 2,
  },
  continent4: {
    width: 7,
    height: 3,
    bottom: 6,
    left: 8,
    borderRadius: 1,
  },
  decorativeIcon: {
    position: "absolute",
  },
  topLeftIcon: {
    top: height * 0.25,
    left: width * 0.2,
  },
  topRightIcon: {
    top: height * 0.3,
    right: width * 0.15,
  },
  bottomIcon: {
    bottom: height * 0.35,
    left: width * 0.25,
  },
  diamond: {
    width: 8,
    height: 8,
    transform: [{ rotate: "45deg" }],
    borderRadius: 1,
  },
  circle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
