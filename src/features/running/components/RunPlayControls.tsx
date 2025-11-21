// components/Running/RunPlayControls.tsx
import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RunPlayControls({
  isRunning,
  isPaused,
  onPlay,
  onPause,
  onResume,
  onStopTap,
  onStopLong,
}: {
  isRunning: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopTap: () => void;
  onStopLong: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 12);
  const BASE = 40;

  const playIcon = !isRunning || isPaused ? "play" : "pause";

  return (
    <View style={[styles.container, { bottom: bottomSafe + 28 }]}>
      <Pressable
        style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
        onPress={() => {
          if (!isRunning) onPlay();
          else if (isPaused) onResume();
          else onPause();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          !isRunning ? "재생" : isPaused ? "재개" : "일시정지"
        }
      >
        <Ionicons name={playIcon} size={30} color="#111827" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
        onPress={onStopTap}
        onLongPress={onStopLong}
        delayLongPress={2000}
        accessibilityRole="button"
        accessibilityLabel="종료"
      >
        <Ionicons name="stop" size={28} color="#111827" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
  },
  circle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
});
