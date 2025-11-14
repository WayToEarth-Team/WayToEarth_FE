import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type WeeklyItem = { day: string; distance: number };
type RankingItem = {
  rank: number;
  name: string;
  distance: number;
  isUser?: boolean;
  imageUrl?: string | null;
};

type Props = {
  title?: string;
  weeklyData?: WeeklyItem[];
  rankingData?: RankingItem[];
  totalDistance?: number;
  percentChange?: number;
  embedded?: boolean;
};

const DEFAULT_WEEKLY: WeeklyItem[] = [
  { day: "01", distance: 6.5 },
  { day: "02", distance: 8.2 },
  { day: "03", distance: 5.8 },
  { day: "04", distance: 7.1 },
  { day: "05", distance: 9.3 },
  { day: "06", distance: 6.9 },
  { day: "07", distance: 4.95 },
  { day: "08", distance: 0 },
];

const DEFAULT_RANKING: RankingItem[] = [
  { rank: 1, name: "Andy William", distance: 59.13, isUser: false },
  { rank: 2, name: "You", distance: 48.75, isUser: true },
  { rank: 3, name: "Thomas Speed", distance: 32.67, isUser: false },
];

export default function CrewRecord({
  title = "지난주 러닝",
  weeklyData = DEFAULT_WEEKLY,
  rankingData = DEFAULT_RANKING,
  totalDistance = 48.75,
  percentChange = 2.1,
  embedded = false,
}: Props) {
  const maxDistance = Math.max(...weeklyData.map((d) => d.distance));

  const Inner = (
    <View
      style={[
        s.container,
        embedded && {
          paddingHorizontal: 0,
          paddingVertical: 0,
          backgroundColor: "transparent",
        },
      ]}
    >
      {/* 주간 러닝 통계 */}
      <View style={s.statsCard}>
        <View style={s.statsHeader}>
          <View style={s.statsHeaderLeft}>
            <Ionicons name="walk-outline" size={20} color="#1F2937" style={{ marginRight: 8 }} />
            <Text style={s.statsTitle}>{title}</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
        </View>

        <Text style={s.totalDistance}>{totalDistance.toFixed(2)} km</Text>
        <Text
          style={[
            s.percentChange,
            percentChange < 0 ? { color: "#EF4444" } : { color: "#10B981" },
          ]}
        >
          지난주 대비 {percentChange >= 0 ? "↑" : "↓"} {Math.abs(percentChange)}%
        </Text>

        {/* 막대 그래프 */}
        <View style={s.chartContainer}>
          {weeklyData.map((item, index) => {
            const heightPercent =
              item.distance > 0 ? (item.distance / maxDistance) * 100 : 0;
            return (
              <View key={index} style={s.barWrapper}>
                <View style={s.barContainer}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: item.distance > 0 ? `${heightPercent}%` : 2,
                        backgroundColor:
                          item.distance > 0 ? "#5B7FFF" : "#E5E7EB",
                      },
                    ]}
                  />
                </View>
                <Text style={s.dayLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 주간 랭킹 */}
      <View style={s.rankingCard}>
        <View style={s.rankingHeader}>
          <View style={s.rankingHeaderLeft}>
            <Ionicons name="medal-outline" size={20} color="#1F2937" style={{ marginRight: 8 }} />
            <Text style={s.rankingTitle}>주간 랭킹</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
        </View>

        {rankingData.map((item, index) => (
          <View
            key={index}
            style={[
              s.rankingItem,
              item.isUser && s.rankingItemHighlight,
              index === rankingData.length - 1 && s.rankingItemLast,
            ]}
          >
            <Text style={s.rankNumber}>
              {String(item.rank).padStart(2, "0")}.
            </Text>

            <View style={s.rankingAvatar}>
              <View style={s.avatarCircle}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
                )}
              </View>
            </View>

            <Text style={[s.rankingName, item.isUser && s.rankingNameBold]}>
              {item.name}
            </Text>

            <Text style={s.rankingDistance}>{item.distance.toFixed(2)} km</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (embedded) return Inner;
  return <ScrollView style={s.scrollContainer}>{Inner}</ScrollView>;
}

const s = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
  },

  // 통계 카드
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  arrowIcon: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  totalDistance: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  percentChange: {
    fontSize: 14,
    color: "#10B981",
    marginBottom: 24,
  },

  // 차트
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 2,
  },
  barContainer: {
    width: "100%",
    height: 90,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "80%",
    borderRadius: 4,
    minHeight: 2,
  },
  dayLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 8,
  },

  // 랭킹 카드
  rankingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rankingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  rankingHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankingIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  rankingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },

  // 랭킹 아이템
  rankingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rankingItemLast: {
    borderBottomWidth: 0,
  },
  rankingItemHighlight: {
    backgroundColor: "#F0F4FF",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    width: 32,
  },
  rankingAvatar: {
    marginRight: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20, resizeMode: "cover" },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  rankingName: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
  },
  rankingNameBold: {
    fontWeight: "600",
    color: "#111827",
  },
  rankingDistance: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
  },
});
