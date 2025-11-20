import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

export default function MainFab({
  label = "시작",
  size = 120,
  onPress,
  breathing = true, // 숨쉬기 효과 on/off
  showProgress = false,
  progress = 0, // 0~1
}: {
  label?: string;
  size?: number;
  onPress: () => void;
  breathing?: boolean;
  showProgress?: boolean;
  progress?: number;
}) {
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!breathing) {
      halo.stopAnimation();
      halo.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathing]);

  const haloScale = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });
  const haloOpacity = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.18],
  });

  const strokeW = 6;
  const r = (size - strokeW) / 2;
  const C = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, progress)) * C;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 숨쉬는 배경 링 */}
      {breathing && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: "#3B82F6",
              borderRadius: size / 2,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
      )}

      {/* 진행 링 */}
      {showProgress && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ rotate: "-90deg" }] },
          ]}
        >
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={strokeW}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#FFFFFF"
              strokeWidth={strokeW}
              strokeDasharray={`${dash}, ${C - dash}`}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </View>
      )}

      <Pressable
        android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {}
          );
          onPress();
        }}
        style={[
          styles.mainFab,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <LinearGradient
          colors={["#60A5FA", "#3B82F6"]}
          start={[0, 0]}
          end={[1, 1]}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mainFab: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  text: { color: "#fff", fontSize: 22, fontWeight: "900" },
});
