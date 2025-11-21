import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

export default function ArcMenu({
  open,
  radius = 96,
  leftLabel = "러닝",
  rightLabel = "여정 러닝",
  onLeftPress,
  onRightPress,
  containerStyle,
}: {
  open: boolean;
  radius?: number;
  leftLabel?: string;
  rightLabel?: string;
  onLeftPress: () => void;
  onRightPress: () => void;
  containerStyle?: ViewStyle;
}) {
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(prog, {
      toValue: open ? 1 : 0,
      duration: open ? 260 : 160,
      useNativeDriver: true,
    }).start();
  }, [open]);

  const leftDeg = -120,
    rightDeg = -60;
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  };
  const L = toXY(leftDeg),
    R = toXY(rightDeg);

  const txL = Animated.multiply(prog, radius * L.x);
  const tyL = Animated.multiply(prog, radius * L.y);
  const txR = Animated.multiply(prog, radius * R.x);
  const tyR = Animated.multiply(prog, radius * R.y);
  const scale = prog.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <>
      {/* 왼쪽 */}
      <Animated.View
        style={[
          styles.slot,
          containerStyle,
          {
            transform: [{ translateX: txL }, { translateY: tyL }, { scale }],
            opacity: prog,
          },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={styles.smallFab} onPress={onLeftPress}>
          <Text style={styles.smallText}>{leftLabel}</Text>
        </Pressable>
      </Animated.View>

      {/* 오른쪽 */}
      <Animated.View
        style={[
          styles.slot,
          containerStyle,
          {
            transform: [{ translateX: txR }, { translateY: tyR }, { scale }],
            opacity: prog,
          },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        <Pressable style={styles.smallFab} onPress={onRightPress}>
          <Text style={styles.smallText}>{rightLabel}</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  smallFab: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallText: { fontSize: 16, fontWeight: "800", color: "#111" },
});
