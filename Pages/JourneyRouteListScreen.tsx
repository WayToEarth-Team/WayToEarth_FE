import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import useRouteList from "../hooks/journey/useJourneyRouteList";
import type { RouteSummary } from "../utils/api/journeyRoutes";
import { getJourneyLandmarks } from "../utils/api/landmarks";
import ImageCarousel from "../components/Common/ImageCarousel";
import StatItem from "../components/Journey/StatItem";
import { colors } from "../assets/styles/colors";
import { commonStyles } from "../assets/styles/commonStyles";
import { Ionicons } from "@expo/vector-icons";

export default function RouteListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("전체");
  const { data: routes, loading } = useRouteList();
  const [journeyImages, setJourneyImages] = useState<Record<string, string[]>>({});

  const tabs = ["전체", "국내 여행", "해외 여행"];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "쉬움":
        return colors.green;
      case "보통":
        return colors.yellow;
      case "어려움":
        return colors.red;
      default:
        return colors.gray500;
    }
  };

  const getProgressPercentage = (route: RouteSummary | any) => {
    const p = Number(route?.userProgressPercent ?? NaN);
    if (Number.isFinite(p)) return Math.round(Math.max(0, Math.min(100, p)));
    const completed = Number((route as any)?.completed ?? 0);
    const total = Number((route as any)?.total ?? 0);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  useEffect(() => {
    if (!routes || routes.length === 0) return;
    (async () => {
      const imagesMap: Record<string, string[]> = {};
      for (const r of routes) {
        try {
          const lms = await getJourneyLandmarks(Number(r.id));
          const urls = (lms || [])
            .map((lm) => lm.imageUrl)
            .filter((u): u is string => !!u?.trim());
          if (urls.length) imagesMap[String(r.id)] = urls;
        } catch (err) {
          if (__DEV__) console.warn("[RouteList] landmark images failed:", err);
        }
      }
      setJourneyImages(imagesMap);
    })();
  }, [routes]);

  const filtered = useMemo(() => {
    const list = (routes ?? []) as RouteSummary[];
    if (activeTab === "전체") return list;
    const want = activeTab === "국내 여행" ? "DOMESTIC" : "INTERNATIONAL";
    return list.filter((r: any) => r?.category === want);
  }, [routes, activeTab]);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>여정 리스트</Text>
          <TouchableOpacity
            style={styles.guestbookButton}
            onPress={() => navigation?.navigate?.("GuestbookScreen")}
            accessibilityLabel="방명록"
          >
            <Ionicons name="book-outline" size={18} color={colors.white} />
            <Text style={styles.guestbookText}>방명록</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {loading && <Text style={styles.loadingText}>로딩 중...</Text>}
        {filtered.map((route: RouteSummary) => {
          // 여정의 랜드마크 이미지 사용
          const carouselImages = journeyImages[String(route.id)] || [];

          return (
            <TouchableOpacity
              key={route.id}
              style={styles.routeCard}
              onPress={() =>
                navigation?.navigate?.("JourneyRouteDetail", { id: route.id })
              }
            >
              <View style={styles.routeImageContainer}>
                <ImageCarousel
                  images={carouselImages}
                  height={200}
                  borderRadius={0}
                  autoPlayInterval={4000}
                />
                <View style={styles.progressBadge}>
                  <Text style={styles.progressText}>
                    {getProgressPercentage(route)}% 완료
                  </Text>
                </View>
                <TouchableOpacity style={styles.favoriteButton}>
                  <Text style={styles.favoriteIcon}>역사 탐방</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.routeInfo}>
                <Text style={commonStyles.sectionTitle}>
                  {route.title ?? ""}
                </Text>
                <Text style={commonStyles.sectionDescription} numberOfLines={3}>
                  {route.description ?? ""}
                </Text>

                <View style={styles.routeTags}>
                  {(route.tags ?? []).map((tag, index) => (
                    <View
                      key={`${route.id}-tag-${index}`}
                      style={commonStyles.tag}
                    >
                      <Text style={commonStyles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.routeStats}>
                  <StatItem value={route.distance ?? ""} />
                  <StatItem value={route.duration ?? ""} />
                  <StatItem
                    value={route.difficulty ?? ""}
                    color={getDifficultyColor(route.difficulty ?? "")}
                  />
                </View>

                <Text style={styles.participantCount}>
                  함께한 러너{" "}
                  {Number(route.runningTogether ?? 0).toLocaleString()}명
                  <Text style={styles.completedCount}> ▶ 8개 랜드마크</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: colors.gray800 },
  guestbookButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brown,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  guestbookIcon: { fontSize: 16 },
  guestbookText: { fontSize: 13, fontWeight: "600", color: colors.white },
  tabContainer: { flexDirection: "row" },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  activeTab: { backgroundColor: colors.indigoLight },
  tabText: { fontSize: 14, color: colors.gray500, fontWeight: "500" },
  activeTabText: { color: colors.indigo, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 20 },
  loadingText: { padding: 16, color: colors.gray500 },
  routeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginTop: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  routeImageContainer: {
    height: 200,
    backgroundColor: colors.gray800,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  progressBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressText: { color: colors.white, fontSize: 12, fontWeight: "600" },
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.indigo,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favoriteIcon: { color: colors.white, fontSize: 12, fontWeight: "600" },
  routeInfo: { padding: 16 },
  routeTags: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  routeStats: { flexDirection: "row", marginBottom: 8 },
  participantCount: { fontSize: 12, color: colors.gray400 },
  completedCount: { color: colors.indigo, fontWeight: "500" },
});
