// components/Running/RunStatsCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RunStatsCard({
  distanceKm,
  paceLabel,
  kcal,
  speedKmh,
  elapsedSec,
}: {
  distanceKm: number;
  paceLabel: string;
  kcal: number;
  speedKmh?: number;
  elapsedSec?: number;
}) {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 12);
  const BASE = 120;

  const fmtTime = (s?: number) => {
    if (!s || !Number.isFinite(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { bottom: bottomSafe + BASE }]}>
      <View style={styles.card}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{fmtTime(elapsedSec)}</Text>
          <Text style={styles.statLabel}>시간</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{distanceKm.toFixed(2)}</Text>
          <Text style={styles.statLabel}>거리(km)</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{paceLabel}</Text>
          <Text style={styles.statLabel}>평균 페이스</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{kcal}</Text>
          <Text style={styles.statLabel}>칼로리</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  statItem: { alignItems: "center", minWidth: 80 },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "400",
    textAlign: "center",
  },
});
