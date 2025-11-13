// components/Journey/JourneyProgressCard.tsx
// 여정 진행률 표시 카드

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  progressPercent: number;
  currentDistanceKm: number;
  totalDistanceKm: number;
  nextLandmark: {
    name: string;
    distanceKm: number;
    id?: number;
  } | null;
  onPressGuestbook?: (landmarkId: number) => void;
};

export default function JourneyProgressCard({
  progressPercent,
  currentDistanceKm,
  totalDistanceKm,
  nextLandmark,
  onPressGuestbook,
}: Props) {
  const remainingKm = Math.max(0, totalDistanceKm - currentDistanceKm);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>여정 진행률</Text>
        <Text style={styles.percent}>{progressPercent.toFixed(1)}%</Text>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={["#10B981", "#34D399", "#6EE7B7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, progressPercent)}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>완주</Text>
          <Text style={styles.statValue}>{currentDistanceKm.toFixed(2)} km</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>남은 거리</Text>
          <Text style={styles.statValue}>{remainingKm.toFixed(2)} km</Text>
        </View>
      </View>

      {nextLandmark && (
        <View style={styles.nextLandmark}>
          <View style={styles.nextLandmarkHeader}>
            <View>
              <Text style={styles.nextLandmarkLabel}>다음 랜드마크</Text>
              <Text style={styles.nextLandmarkName}>{nextLandmark.name}</Text>
              <Text style={styles.nextLandmarkDistance}>
                {(nextLandmark.distanceKm - currentDistanceKm).toFixed(2)} km 남음
              </Text>
            </View>
            {nextLandmark.id && onPressGuestbook && (
              <TouchableOpacity
                style={styles.guestbookButton}
                onPress={() => onPressGuestbook(nextLandmark.id!)}
              >
                <Text style={styles.guestbookButtonText}>📋</Text>
                <Text style={styles.guestbookButtonLabel}>방명록</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  percent: {
    fontSize: 16,
    fontWeight: "800",
    color: "#6366F1",
    textShadowColor: "rgba(99, 102, 241, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  progressBarContainer: {
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    shadowColor: "#10B981",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 3,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  nextLandmark: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  nextLandmarkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextLandmarkLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 3,
    fontWeight: "500",
  },
  nextLandmarkName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
    marginBottom: 2,
  },
  nextLandmarkDistance: {
    fontSize: 11,
    color: "#4B5563",
  },
  guestbookButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  guestbookButtonText: {
    fontSize: 18,
    marginBottom: 2,
  },
  guestbookButtonLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#6B7280",
  },
});
