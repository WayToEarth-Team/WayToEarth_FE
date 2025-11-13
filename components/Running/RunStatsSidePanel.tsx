// components/Running/RunStatsSidePanel.tsx
// 여정 러닝 전용 - 오른쪽에서 스와이프하여 열리는 통계 패널

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from "react-native";

type Props = {
  distanceKm: number;
  paceLabel: string;
  kcal: number;
  elapsedSec: number;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PANEL_WIDTH = 75; // 내용에 딱 맞는 너비 (100 → 75)
const HANDLE_WIDTH = 14; // 드래그 핸들 너비 (16 → 14)

export default function RunStatsSidePanel({
  distanceKm,
  paceLabel,
  kcal,
  elapsedSec,
}: Props) {
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current; // 초기: 숨김
  const [expanded, setExpanded] = useState(false);
  const lastTap = useRef<number | null>(null);

  const onToggle = useCallback(
    (toExpand: boolean) => {
      setExpanded(toExpand);
      Animated.spring(translateX, {
        toValue: toExpand ? 0 : PANEL_WIDTH,
        useNativeDriver: true,
        stiffness: 200,
        damping: 25,
        mass: 0.8,
      }).start();
    },
    [translateX]
  );

  // 더블 탭 핸들러
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      // 더블 탭 감지
      onToggle(!expanded);
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  }, [expanded, onToggle]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: (_, g) => {
        // 왼쪽으로 당기면 열리고, 오른쪽으로 밀면 닫힘
        const next = Math.min(
          PANEL_WIDTH,
          Math.max(0, (expanded ? 0 : PANEL_WIDTH) - g.dx)
        );
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const threshold = PANEL_WIDTH / 2;
        const current = (translateX as any)._value as number;
        const shouldExpand = g.vx < 0 || current < threshold;
        onToggle(shouldExpand);
      },
    })
  ).current;

  // 시간 포맷
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }],
        },
      ]}
    >
      {/* 드래그 핸들 (세로, 왼쪽 가장자리) - 더블 탭 가능 */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>
      </TouchableWithoutFeedback>

      {/* 통계 내용 */}
      <View style={styles.content}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statLabel}>시간</Text>
          <Text style={styles.statValue}>{formatTime(elapsedSec)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Text style={styles.statIcon}>📏</Text>
          <Text style={styles.statLabel}>거리</Text>
          <Text style={styles.statValue}>{distanceKm.toFixed(2)}km</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⚡</Text>
          <Text style={styles.statLabel}>페이스</Text>
          <Text style={styles.statValue}>{paceLabel}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Text style={styles.statIcon}>🔥</Text>
          <Text style={styles.statLabel}>칼로리</Text>
          <Text style={styles.statValue}>{Math.round(kcal)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 0,
    top: 180, // 상단 여백 (여정 진행 박스 아래)
    bottom: 230, // 하단 버튼 영역 확보 (스탬프 바텀시트 90px 고려)
    width: PANEL_WIDTH + HANDLE_WIDTH,
    flexDirection: "row",
    zIndex: 500, // 바텀시트보다 낮게
  },
  dragHandleArea: {
    width: HANDLE_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
    elevation: 6,
  },
  dragHandle: {
    width: 3,
    height: 35,
    borderRadius: 2,
    backgroundColor: "#d0d0d0",
  },
  content: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingVertical: 12,
    paddingHorizontal: 6,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
    elevation: 6,
  },
  statItem: {
    alignItems: "center",
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
});
