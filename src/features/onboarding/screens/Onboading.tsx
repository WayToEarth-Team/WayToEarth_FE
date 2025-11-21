import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ensureAccessToken } from "@utils/auth/tokenManager";
import { getMyProfile } from "@utils/api/users";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "@types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  registerForPushNotificationsAsync,
  sendTokenToServer,
} from "@utils/notifications";

const { width, height } = Dimensions.get("window");

export default function Onboarding() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // 러너 애니메이션
  const runnerBounce = useRef(new Animated.Value(0)).current;
  const legAnim1 = useRef(new Animated.Value(0)).current;
  const legAnim2 = useRef(new Animated.Value(0)).current;
  const armAnim1 = useRef(new Animated.Value(0)).current;
  const armAnim2 = useRef(new Animated.Value(0)).current;

  // 파티클 효과
  const particleAnims = useRef(
    Array.from({ length: 5 }, () => ({
      x: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  type Navigation = NativeStackNavigationProp<RootStackParamList, "Onboarding">;
  const navigation = useNavigation<Navigation>();

  useEffect(() => {
    // 1. 초기 페이드인
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. 지구 미묘한 회전
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 40000,
        useNativeDriver: true,
      })
    ).start();

    // 3. 글로우 펄스
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 4. 러너 바운스
    Animated.loop(
      Animated.sequence([
        Animated.timing(runnerBounce, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(runnerBounce, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 5. 다리 움직임
    Animated.loop(
      Animated.sequence([
        Animated.timing(legAnim1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(legAnim1, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(legAnim2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(legAnim2, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 6. 팔 움직임
    Animated.loop(
      Animated.sequence([
        Animated.timing(armAnim1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(armAnim1, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(armAnim2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(armAnim2, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 7. 파티클 효과 (러너 뒤에서 날아가는)
    particleAnims.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim.x, {
              toValue: -50,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim.x, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });

    // 자동 로그인 로직
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
      navTimer = setTimeout(() => navigation.navigate("Login" as never), 2000);
    })();

    return () => {
      if (navTimer) clearTimeout(navTimer);
    };
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  const runnerY = runnerBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });

  const leg1Rotate = legAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "40deg"],
  });

  const leg2Rotate = legAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "40deg"],
  });

  const arm1Rotate = armAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-30deg"],
  });

  const arm2Rotate = armAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-30deg"],
  });

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* 모던한 화이트 그라데이션 배경 */}
      <LinearGradient
        colors={["#FFFFFF", "#F8FAFC", "#F1F5F9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* 배경 글로우 */}
          <Animated.View
            style={[styles.backgroundGlow, { opacity: glowOpacity }]}
          >
            <LinearGradient
              colors={[
                "rgba(59, 130, 246, 0.15)",
                "rgba(147, 197, 253, 0.1)",
                "transparent",
              ]}
              style={styles.glowGradient}
            />
          </Animated.View>

          {/* 지구 */}
          <Animated.View
            style={[styles.earthContainer, { transform: [{ rotate }] }]}
          >
            <LinearGradient
              colors={["#E0F2FE", "#BAE6FD", "#7DD3FC", "#38BDF8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earthCircle}
            >
              {/* 미니멀한 대륙 표현 */}
              <View style={[styles.landmass, styles.land1]} />
              <View style={[styles.landmass, styles.land2]} />
              <View style={[styles.landmass, styles.land3]} />
              <View style={[styles.landmass, styles.land4]} />
              <View style={[styles.landmass, styles.land5]} />

              {/* 밝은 하이라이트 */}
              <View style={styles.earthHighlight} />
            </LinearGradient>
          </Animated.View>

          {/* 러너 (지구 표면 위) */}
          <Animated.View
            style={[
              styles.runnerContainer,
              { transform: [{ translateY: runnerY }] },
            ]}
          >
            {/* 파티클 효과 */}
            <View style={styles.particleContainer}>
              {particleAnims.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.particle,
                    {
                      opacity: anim.opacity,
                      transform: [
                        { translateX: anim.x },
                        { translateY: index * 3 },
                      ],
                    },
                  ]}
                />
              ))}
            </View>

            {/* 러너 몸 */}
            <View style={styles.runner}>
              {/* 머리 */}
              <View style={styles.head} />

              {/* 몸통 */}
              <View style={styles.torso} />

              {/* 왼팔 */}
              <Animated.View
                style={[
                  styles.arm,
                  styles.armLeft,
                  { transform: [{ rotate: arm1Rotate }] },
                ]}
              />

              {/* 오른팔 */}
              <Animated.View
                style={[
                  styles.arm,
                  styles.armRight,
                  { transform: [{ rotate: arm2Rotate }] },
                ]}
              />

              {/* 왼다리 */}
              <Animated.View
                style={[
                  styles.leg,
                  styles.legLeft,
                  { transform: [{ rotate: leg1Rotate }] },
                ]}
              />

              {/* 오른다리 */}
              <Animated.View
                style={[
                  styles.leg,
                  styles.legRight,
                  { transform: [{ rotate: leg2Rotate }] },
                ]}
              />
            </View>
          </Animated.View>

          {/* 앱 이름 */}
          <View style={styles.textContainer}>
            <Text style={styles.appName}>WaytoEarth</Text>
            <View style={styles.taglineContainer}>
              <View style={styles.dividerLeft} />
              <Text style={styles.tagline}>RUN FOR THE PLANET</Text>
              <View style={styles.dividerRight} />
            </View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  gradientBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 150,
  },
  earthContainer: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  earthCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 90,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  earthHighlight: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    top: 20,
    left: 30,
  },
  landmass: {
    position: "absolute",
    backgroundColor: "rgba(52, 211, 153, 0.6)",
    borderRadius: 12,
  },
  land1: {
    width: 50,
    height: 45,
    top: 20,
    left: 30,
    borderRadius: 15,
  },
  land2: {
    width: 35,
    height: 40,
    top: 65,
    left: 45,
    borderRadius: 12,
  },
  land3: {
    width: 40,
    height: 35,
    top: 30,
    right: 25,
    borderRadius: 10,
  },
  land4: {
    width: 30,
    height: 35,
    bottom: 35,
    right: 30,
    borderRadius: 8,
  },
  land5: {
    width: 25,
    height: 25,
    bottom: 40,
    left: 35,
    borderRadius: 8,
  },
  runnerContainer: {
    position: "absolute",
    top: -15,
    alignItems: "center",
  },
  particleContainer: {
    position: "absolute",
    left: -30,
    top: 15,
  },
  particle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#60A5FA",
    marginVertical: 2,
    shadowColor: "#60A5FA",
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  runner: {
    width: 40,
    height: 55,
    position: "relative",
  },
  head: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FBBF24",
    position: "absolute",
    top: 0,
    left: 11,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  torso: {
    width: 16,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    position: "absolute",
    top: 18,
    left: 12,
    shadowColor: "#3B82F6",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  arm: {
    width: 5,
    height: 18,
    borderRadius: 2.5,
    backgroundColor: "#3B82F6",
    position: "absolute",
    top: 20,
  },
  armLeft: {
    left: 8,
    transformOrigin: "top center",
  },
  armRight: {
    right: 8,
    transformOrigin: "top center",
  },
  leg: {
    width: 6,
    height: 20,
    borderRadius: 3,
    backgroundColor: "#1E40AF",
    position: "absolute",
    top: 35,
  },
  legLeft: {
    left: 10,
    transformOrigin: "top center",
  },
  legRight: {
    right: 10,
    transformOrigin: "top center",
  },
  textContainer: {
    alignItems: "center",
    marginTop: 140,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: 1,
  },
  taglineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  dividerLeft: {
    width: 30,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  dividerRight: {
    width: 30,
    height: 1,
    backgroundColor: "#CBD5E1",
  },
  tagline: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 2,
  },
});
