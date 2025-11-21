import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type WeeklyItem = { label: string; thisWeek: number; lastWeek: number; name?: string };
type RankingItem = {
  rank: number;
  name: string;
  thisWeek: number;
  lastWeek: number;
  isUser?: boolean;
  imageUrl?: string | null;
  userId?: number | string;
};

type Props = {
  title?: string;
  weeklyData?: WeeklyItem[];
  rankingData?: RankingItem[];
  totalDistance?: number;
  lastWeekTotal?: number;
  percentChange?: number | null;
  embedded?: boolean;
};

const DEFAULT_WEEKLY: WeeklyItem[] = Array.from({ length: 8 }).map((_, i) => ({
  label: String(i + 1).padStart(2, "0"),
  thisWeek: 0,
  lastWeek: 0,
}));

const DEFAULT_RANKING: RankingItem[] = Array.from({ length: 8 }).map((_, i) => ({
  rank: i + 1,
  name: "-",
  thisWeek: 0,
  lastWeek: 0,
  isUser: false,
}));

export default function CrewRecord({
  title = "이번주 러닝",
  weeklyData = DEFAULT_WEEKLY,
  rankingData = DEFAULT_RANKING,
  totalDistance = 48.75,
  lastWeekTotal,
  percentChange = 2.1,
  embedded = false,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeIndexSide, setActiveIndexSide] = useState<"left" | "right" | null>(null);
  const derivedLastWeekTotal = lastWeekTotal ?? weeklyData.reduce((acc, cur) => acc + (Number(cur.lastWeek) || 0), 0);
  const derivedPercent = (() => {
    const last = derivedLastWeekTotal;
    const cur = totalDistance;
    if (last === 0 && cur === 0) return 0;
    if (last === 0) return Infinity; // 지난주 0에서 이번주 달성 -> 신규
    return ((cur - last) / last) * 100;
  })();
  const displayPercent = percentChange ?? derivedPercent;
  const maxDistance = Math.max(
    ...weeklyData.flatMap((d) => [d.thisWeek, d.lastWeek, 0]).filter((v) => Number.isFinite(v)),
    0
  );

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
            <Ionicons
              name="walk-outline"
              size={20}
              color="#1F2937"
              style={{ marginRight: 8 }}
            />
            <Text style={s.statsTitle}>{title}</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
        </View>

        <Text style={s.totalDistance}>{(Math.floor(totalDistance * 100) / 100).toFixed(2)} km</Text>
        <Text
          style={[
            s.percentChange,
            displayPercent != null && displayPercent < 0 ? { color: "#EF4444" } : { color: "#10B981" },
          ]}
        >
          {displayPercent == null
            ? "지난주 대비 계산 불가"
            : displayPercent === Infinity
            ? "지난주 대비 ↑ 신규"
            : `지난주 대비 ${displayPercent >= 0 ? "↑" : "↓"} ${Math.abs(displayPercent).toFixed(1)}%`}
        </Text>

        {/* 막대 그래프 */}
        <View style={s.chartContainer}>
          {weeklyData.map((item, index) => {
            const barAreaHeight = 100;
            const leftHeight = maxDistance > 0 ? Math.max((item.thisWeek / maxDistance) * barAreaHeight, 2) : 2;
            const rightHeight = maxDistance > 0 ? Math.max((item.lastWeek / maxDistance) * barAreaHeight, 2) : 2;
            const isActive = activeIndex === index;
            const activeSide = isActive ? activeIndexSide : null;
            const leftActive = isActive && activeSide === "left";
            const rightActive = isActive && activeSide === "right";
            return (
              <View key={index} style={s.barWrapper}>
                <View style={[s.barPairWrapper, { height: barAreaHeight + 32 }]}>
                  {isActive && (
                    <View
                      style={[
                        s.valueBubble,
                        { bottom: (activeSide === "left" ? leftHeight : activeSide === "right" ? rightHeight : Math.max(leftHeight, rightHeight)) + 8 },
                      ]}
                    >
                      <Text style={s.valueBubbleText}>
                        {leftActive
                          ? `이번주 ${(Math.floor(item.thisWeek * 100) / 100).toFixed(2)} km`
                          : rightActive
                          ? `지난주 ${(Math.floor(item.lastWeek * 100) / 100).toFixed(2)} km`
                          : `이번주 ${(Math.floor(item.thisWeek * 100) / 100).toFixed(2)} km / 지난주 ${(Math.floor(item.lastWeek * 100) / 100).toFixed(2)} km`}
                      </Text>
                    </View>
                  )}
                  <View style={[s.barPair, { height: barAreaHeight }]}>
                    <View
                      style={[
                        s.bar,
                        s.barLeft,
                        {
                        height: leftHeight,
                        backgroundColor: item.thisWeek > 0 ? "#5B7FFF" : "#E5E7EB",
                        opacity: leftActive || !isActive ? 1 : 0.5,
                        },
                      ]}
                    onTouchEnd={() => {
                      if (activeIndex === index && activeIndexSide === "left") {
                        setActiveIndex(null);
                        setActiveIndexSide(null);
                      } else {
                        setActiveIndex(index);
                        setActiveIndexSide("left");
                      }
                    }}
                  />
                  <View
                      style={[
                        s.bar,
                        s.barRight,
                        {
                        height: rightHeight,
                        backgroundColor: item.lastWeek > 0 ? "#9CA3AF" : "#E5E7EB",
                        opacity: rightActive || !isActive ? 1 : 0.5,
                        },
                    ]}
                    onTouchEnd={() => {
                      if (activeIndex === index && activeIndexSide === "right") {
                        setActiveIndex(null);
                        setActiveIndexSide(null);
                      } else {
                        setActiveIndex(index);
                        setActiveIndexSide("right");
                      }
                    }}
                  />
                </View>
                </View>
                <Text style={s.dayLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 주간 랭킹 */}
      <View style={s.rankingCard}>
        <View style={s.rankingHeader}>
          <View style={s.rankingHeaderLeft}>
            <Ionicons
              name="medal-outline"
              size={20}
              color="#1F2937"
              style={{ marginRight: 8 }}
            />
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

            <Text style={s.rankingDistance}>{(Math.floor(item.thisWeek * 100) / 100).toFixed(2)} km</Text>
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
    fontSize: 13,
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
  barPair: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 4,
    width: "100%",
    height: 100,
  },
  barPairWrapper: {
    position: "relative",
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barContainer: {
    width: "100%",
    height: 90,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "40%",
    borderRadius: 4,
    minHeight: 2,
  },
  barLeft: {
    backgroundColor: "#5B7FFF",
  },
  barRight: {
    backgroundColor: "#9CA3AF",
  },
  dayLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 8,
  },
  valueLabel: {
    fontSize: 11,
    color: "#374151",
    marginTop: 4,
    textAlign: "center",
  },
  valueLabelTop: {
    fontSize: 11,
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  valueBubble: {
    position: "absolute",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(17,24,39,0.9)",
    minWidth: 80,
  },
  valueBubbleText: {
    fontSize: 11,
    color: "#fff",
    textAlign: "center",
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
