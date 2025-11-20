import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// import * as Haptics from "expo-haptics";

type Props = {
  visible: boolean;
  seconds?: number; // 기본 3초
  onDone: () => void; // 카운트 종료 콜백
};

export default function CountdownOverlay({
  visible,
  seconds = 3,
  onDone,
}: Props) {
  const [count, setCount] = useState(seconds);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneCalled = useRef(false);

  const label = useMemo(() => String(count), [count]);

  // visible 바뀔 때 초기화
  useEffect(() => {
    if (!visible) {
      cleanup();
      doneCalled.current = false;
      return;
    }
    // 오픈 시 리셋 후 첫 사이클 시작
    doneCalled.current = false;
    setCount(seconds);
    runOneCycle(seconds);

    // cleanup on unmount/close
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, seconds]);

  const cleanup = () => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // 애니메이션 값 리셋(눈에 띄는 깜빡임 방지용)
    scale.stopAnimation();
    opacity.stopAnimation();
  };

  const runOneCycle = (current: number) => {
    if (!visible) return;

    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    scale.setValue(0.6);
    opacity.setValue(0);

    const seq = Animated.parallel([
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          delay: 420,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animRef.current = seq;
    seq.start(({ finished }) => {
      if (!finished || !visible) return;

      // 다음 틱에서 처리(렌더 단계와 분리)
      timeoutRef.current = setTimeout(() => {
        if (current > 1) {
          setCount((prev) => {
            const next = Math.max(1, prev - 1);
            // 다음 숫자 애니메이션
            runOneCycle(next);
            return next;
          });
        } else if (!doneCalled.current) {
          doneCalled.current = true;
          // 부모 업데이트는 렌더/커밋 이후로 확실히 밀기
          setTimeout(() => {
            if (visible) onDone?.();
          }, 0);
        }
      }, 60);
    });
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#9EC5FF", "#CFE4FF"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <Animated.Text
          accessibilityLabel={`${label}`}
          style={[styles.countText, { transform: [{ scale }], opacity }]}
        >
          {label}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 160,
    fontWeight: "900",
    color: "#111",
    letterSpacing: -2,
  },
});
