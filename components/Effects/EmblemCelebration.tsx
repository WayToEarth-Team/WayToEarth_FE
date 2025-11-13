import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

type Props = {
  count?: number;
  onDone?: () => void;
  durationMs?: number;
};

export default function EmblemCelebration({
  count = 1,
  onDone,
  durationMs = 3000,
}: Props) {
  const particles = useMemo(() => Array.from({ length: 50 }, (_, i) => i), []);
  const anims = useRef(
    particles.map(() => {
      const startX = width * 0.5 + (Math.random() - 0.5) * width * 1.2;
      const endX = startX + (Math.random() - 0.5) * 150;
      return {
        y: new Animated.Value(-100),
        x: new Animated.Value(startX),
        endX: endX,
        rot: new Animated.Value(0),
        scale: new Animated.Value(0.5 + Math.random() * 0.9),
        opacity: new Animated.Value(1),
      };
    })
  ).current;

  const cardScale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const trophyBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Card entrance animation
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Trophy bounce
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(trophyBounce, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Confetti animations
    const timings = anims.map(({ y, rot, opacity }) =>
      Animated.parallel([
        Animated.timing(y, {
          toValue: height * (0.65 + Math.random() * 0.25),
          duration: durationMs + Math.random() * 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rot, {
          toValue: 3 + Math.random() * 2,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.stagger(30, timings).start(({ finished }) => {
      if (finished) onDone?.();
    });
  }, [
    anims,
    durationMs,
    onDone,
    cardScale,
    cardOpacity,
    glowPulse,
    trophyBounce,
  ]);

  const glowScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.9],
  });

  const trophyScale = trophyBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* Radial gradient background */}
      <View style={styles.backgroundGradient}>
        <LinearGradient
          colors={[
            "rgba(251, 146, 60, 0.15)",
            "rgba(251, 146, 60, 0)",
            "transparent",
          ]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Animated glow behind card */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            transform: [{ scale: glowScale }],
            opacity: glowOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(251, 191, 36, 0.4)",
            "rgba(251, 146, 60, 0.2)",
            "transparent",
          ]}
          style={styles.glowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Center trophy card with blur */}
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          },
        ]}
      >
        <BlurView intensity={40} tint="light" style={styles.blurCard}>
          <View style={styles.cardContent}>
            {/* Animated trophy circle */}
            <Animated.View
              style={[
                styles.trophyWrapper,
                { transform: [{ scale: trophyScale }] },
              ]}
            >
              <LinearGradient
                colors={["#FBBF24", "#F59E0B", "#D97706"]}
                style={styles.trophyCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.trophyInner}>
                  <Ionicons name="trophy" size={48} color="#FFFFFF" />
                </View>
              </LinearGradient>

              {/* Sparkles around trophy */}
              <View style={[styles.sparkle, { top: 8, right: 8 }]}>
                <Ionicons name="sparkles" size={16} color="#FBBF24" />
              </View>
              <View style={[styles.sparkle, { bottom: 8, left: 8 }]}>
                <Ionicons name="sparkles" size={14} color="#F59E0B" />
              </View>
            </Animated.View>

            <View style={styles.textContainer}>
              <Text style={styles.title}>엠블럼 획득</Text>
              <View style={styles.countBadge}>
                <LinearGradient
                  colors={["#FEF3C7", "#FDE68A"]}
                  style={styles.badgeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.countText}>+{count}</Text>
                </LinearGradient>
              </View>
              <Text style={styles.subtitle}>새로운 엠블럼을 획득했어요!</Text>
              <View style={styles.decorativeLine} />
            </View>
          </View>
        </BlurView>
      </Animated.View>

      {/* Enhanced confetti particles */}
      {anims.map((a, idx) => {
        const isCircle = idx % 3 === 0;
        const size = isCircle ? 8 + Math.random() * 6 : 10 + Math.random() * 8;
        const rotate = a.rot.interpolate({
          inputRange: [0, 1],
          outputRange: [
            "0deg",
            `${Math.random() > 0.5 ? "" : "-"}${360 * 3}deg`,
          ],
        });
        const bg = confettiColor(idx);

        return (
          <Animated.View
            key={idx}
            style={{
              position: "absolute",
              top: 0,
              transform: [
                { translateX: a.x },
                { translateY: a.y },
                { rotate },
                { scale: a.scale },
              ],
              width: size,
              height: size,
              borderRadius: isCircle ? size / 2 : 3,
              backgroundColor: bg,
              opacity: a.opacity,
              shadowColor: bg,
              shadowOpacity: 0.5,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          />
        );
      })}

      {/* Starburst particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 8;
        const distance = 100;
        const starAnim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
          Animated.sequence([
            Animated.delay(300 + i * 50),
            Animated.timing(starAnim, {
              toValue: 1,
              duration: 600,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        }, []);

        const translateX = starAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(angle) * distance],
        });

        const translateY = starAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(angle) * distance],
        });

        const opacity = starAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={`star-${i}`}
            style={[
              styles.starBurst,
              {
                transform: [{ translateX }, { translateY }],
                opacity,
              },
            ]}
          >
            <Ionicons name="star" size={12} color="#FBBF24" />
          </Animated.View>
        );
      })}
    </View>
  );
}

function confettiColor(i: number) {
  const colors = [
    "#FBBF24",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#EF4444",
    "#8B5CF6",
    "#F97316",
    "#EC4899",
    "#14B8A6",
    "#F43F5E",
  ];
  return colors[i % colors.length];
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  backgroundGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  glowCircle: {
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
  cardContainer: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  blurCard: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  cardContent: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 28,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  trophyWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  trophyInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  sparkle: {
    position: "absolute",
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  countBadge: {
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  badgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  countText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#D97706",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
  decorativeLine: {
    marginTop: 12,
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FDE68A",
  },
  starBurst: {
    position: "absolute",
  },
});
