import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";

export default function PauseOverlay({ visible }: { visible: boolean }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, {
      toValue: visible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && (op as any).__getValue?.() === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: op }]}
    >
      <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Text style={styles.title}>일시정지</Text>
        <Text style={styles.desc}>재생 ▶ 을 누르면 다시 시작됩니다.</Text>
        <Text style={styles.desc}>
          종료하려면 ■ 버튼을 2초간 길게 누르세요.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  desc: { color: "#4b5563", marginTop: 2 },
});
