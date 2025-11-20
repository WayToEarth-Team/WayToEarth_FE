// src/features/guestbook/components/LandmarkStatistics.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { getLandmarkStatistics } from "@utils/api/guestbook";
import type { LandmarkStatistics as LandmarkStatisticsType } from "@types/guestbook";

interface LandmarkStatisticsProps {
  landmarkId: number;
  onPressGuestbook?: () => void; // 방명록 수 클릭 시 콜백
  onPressVisitors?: () => void; // 방문자 수 클릭 시 콜백
}

/**
 * 랜드마크 통계 컴포넌트
 * - 방명록 수 표시
 * - 방문자 수 표시 (스탬프 기준)
 * - 숫자 포맷팅 (1000 → 1k)
 */
export default function LandmarkStatistics({
  landmarkId,
  onPressGuestbook,
  onPressVisitors,
}: LandmarkStatisticsProps) {
  const [statistics, setStatistics] = useState<LandmarkStatisticsType | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, [landmarkId]);

  const loadStatistics = async () => {
    setLoading(true);
    setError(false);

    try {
      const data = await getLandmarkStatistics(landmarkId);
      setStatistics(data);
    } catch (err: any) {
      console.error("[LandmarkStatistics] 조회 실패:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#6b7280" />
      </View>
    );
  }

  if (error || !statistics) {
    return null; // 에러 시 아무것도 표시하지 않음
  }

  const StatItem = ({
    icon,
    value,
    label,
    onPress,
  }: {
    icon: string;
    value: number;
    label: string;
    onPress?: () => void;
  }) => {
    const Component = onPress ? TouchableOpacity : View;

    return (
      <Component
        style={styles.statItem}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.value}>{formatNumber(value)}</Text>
        <Text style={styles.label}>{label}</Text>
      </Component>
    );
  };

  return (
    <View style={styles.container}>
      <StatItem
        icon="📝"
        value={statistics.totalGuestbook}
        label="방명록"
        onPress={onPressGuestbook}
      />

      <View style={styles.divider} />

      <StatItem
        icon="👥"
        value={statistics.totalVisitors}
        label="방문자"
        onPress={onPressVisitors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  icon: {
    fontSize: 24,
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: "#e9ecef",
    marginHorizontal: 16,
  },
});
