import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getTopCrewsByDistance } from "../utils/api/crewStats";
import { getCrewById } from "../utils/api/crews";

type CrewRanking = {
  id: string;
  name: string;
  distance: string;
  imageUrl?: string;
  memberCount?: number;
  description?: string;
};

type CrewRankingScreenProps = {
  navigation: any;
};

export default function CrewRankingScreen({
  navigation,
}: CrewRankingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<CrewRanking[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<
    "month" | "week" | "all"
  >("month");

  useEffect(() => {
    loadRankings();
  }, [selectedPeriod]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const paramMonth = selectedPeriod === "all" ? undefined : month;
      const list = await getTopCrewsByDistance({ month: paramMonth, limit: 100 });
      let mapped: CrewRanking[] = (list || []).map((t) => ({
        id: t.id,
        name: t.name,
        distance: String(t.distance || "0km").replace(/[^\d.]/g, ""),
        imageUrl: t.imageUrl || undefined,
      }));
      // 상세 정보 보강
      const details = await Promise.allSettled(mapped.map((m) => getCrewById(String(m.id))));
      mapped = mapped.map((m, i) => {
        const res = details[i];
        if (res.status === "fulfilled" && res.value) {
          const d: any = res.value;
          return {
            ...m,
            name: d.name || m.name,
            description: d.description || m.description,
            memberCount: Number(d.currentMembers ?? 0),
            imageUrl: d.profileImageUrl || m.imageUrl,
          };
        }
        return m;
      });
      setRankings(mapped);
    } catch (e) {
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#F59E0B";
    if (rank === 2) return "#94A3B8";
    if (rank === 3) return "#EA580C";
    return "#64748B";
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>크루 랭킹</Text>
        <View style={s.headerRight} />
      </View>

      {/* Period Filter */}
      <View style={s.filterContainer}>
        <TouchableOpacity
          style={[
            s.filterButton,
            selectedPeriod === "week" && s.filterButtonActive,
          ]}
          onPress={() => setSelectedPeriod("week")}
        >
          <Text
            style={[
              s.filterText,
              selectedPeriod === "week" && s.filterTextActive,
            ]}
          >
            이번 주
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.filterButton,
            selectedPeriod === "month" && s.filterButtonActive,
          ]}
          onPress={() => setSelectedPeriod("month")}
        >
          <Text
            style={[
              s.filterText,
              selectedPeriod === "month" && s.filterTextActive,
            ]}
          >
            이번 달
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.filterButton,
            selectedPeriod === "all" && s.filterButtonActive,
          ]}
          onPress={() => setSelectedPeriod("all")}
        >
          <Text
            style={[
              s.filterText,
              selectedPeriod === "all" && s.filterTextActive,
            ]}
          >
            전체
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#475569" />
          <Text style={s.loadingText}>순위를 불러오는 중...</Text>
        </View>
      ) : (
        <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
          {/* Top 3 Podium */}
          <LinearGradient colors={["#F8FAFC", "#FFFFFF"]} style={s.podiumSection}>
            {rankings.length === 2 ? (
              <View style={[s.podiumContainer, { alignItems: "center" }]}>
                {[0, 1].map((idx) => (
                  <View key={rankings[idx].id} style={s.podiumItem}>
                    <View style={s.podiumRank}>
                      <Ionicons
                        name={idx === 0 ? "trophy" : "medal"}
                        size={18}
                        color={getRankColor(idx + 1)}
                      />
                    </View>
                    <View style={[s.podiumAvatar]}>
                      {rankings[idx].imageUrl ? (
                        <Image source={{ uri: rankings[idx].imageUrl }} style={s.avatarImage} />
                      ) : (
                        <Ionicons name="people" size={32} color="#64748B" />
                      )}
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>
                      {rankings[idx].name}
                    </Text>
                    <Text style={s.podiumDistance}>{rankings[idx].distance}km</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.podiumContainer}>
                {rankings[1] && (
                  <View style={s.podiumItem}>
                    <View style={s.podiumRank}>
                      <Ionicons name="medal" size={18} color={getRankColor(2)} />
                    </View>
                    <View style={[s.podiumAvatar, s.podiumAvatar2]}>
                      {rankings[1].imageUrl ? (
                        <Image source={{ uri: rankings[1].imageUrl }} style={s.avatarImage} />
                      ) : (
                        <Ionicons name="people" size={32} color="#64748B" />
                      )}
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>
                      {rankings[1].name}
                    </Text>
                    <Text style={s.podiumDistance}>{rankings[1].distance}km</Text>
                  </View>
                )}
                {rankings[0] && (
                  <View style={[s.podiumItem, s.podiumFirst]}>
                    <View style={s.crownContainer}>
                      <Ionicons name="trophy" size={18} color={getRankColor(1)} />
                    </View>
                    <View style={[s.podiumAvatar, s.podiumAvatar1]}>
                      {rankings[0].imageUrl ? (
                        <Image source={{ uri: rankings[0].imageUrl }} style={s.avatarImage} />
                      ) : (
                        <Ionicons name="people" size={40} color="#F59E0B" />
                      )}
                    </View>
                    <Text style={[s.podiumName, s.podiumName1]} numberOfLines={1}>
                      {rankings[0].name}
                    </Text>
                    <Text style={[s.podiumDistance, s.podiumDistance1]}>
                      {rankings[0].distance}km
                    </Text>
                  </View>
                )}
                {rankings[2] && (
                  <View style={s.podiumItem}>
                    <View style={s.podiumRank}>
                      <Ionicons name="medal" size={18} color={getRankColor(3)} />
                    </View>
                    <View style={[s.podiumAvatar, s.podiumAvatar3]}>
                      {rankings[2].imageUrl ? (
                        <Image source={{ uri: rankings[2].imageUrl }} style={s.avatarImage} />
                      ) : (
                        <Ionicons name="people" size={32} color="#64748B" />
                      )}
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>
                      {rankings[2].name}
                    </Text>
                    <Text style={s.podiumDistance}>{rankings[2].distance}km</Text>
                  </View>
                )}
              </View>
            )}
          </LinearGradient>

          {/* Rankings List */}
          <View style={s.listContainer}>
            <Text style={s.listTitle}>전체 순위</Text>
            {(() => {
              const listStartIndex = rankings.length >= 3 ? 3 : 0;
              const items = rankings.slice(listStartIndex);
              if (items.length === 0) {
                return (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <Text style={{ color: "#94A3B8" }}>
                      표시할 순위가 없습니다.
                    </Text>
                  </View>
                );
              }
              return items.map((crew, index) => {
                const rank = listStartIndex + index + 1;
                return (
                  <TouchableOpacity
                    key={crew.id}
                    style={s.rankItem}
                    activeOpacity={0.7}
                  >
                    <View style={s.rankLeft}>
                      <View
                        style={[
                          s.rankBadge,
                          {
                            backgroundColor: rank <= 10 ? "#F1F5F9" : "#F8FAFC",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.rankNumber,
                            { color: rank <= 10 ? "#475569" : "#94A3B8" },
                          ]}
                        >
                          {rank}
                        </Text>
                      </View>

                      <View style={s.crewAvatar}>
                        {crew.imageUrl ? (
                          <Image
                            source={{ uri: crew.imageUrl }}
                            style={s.avatarImage}
                          />
                        ) : (
                          <Ionicons
                            name="people-outline"
                            size={20}
                            color="#94A3B8"
                          />
                        )}
                      </View>

                      <View style={s.crewInfo}>
                        <Text style={s.crewName} numberOfLines={1}>
                          {crew.name}
                        </Text>
                        {typeof crew.memberCount === "number" && (
                          <Text style={s.crewMembers}>
                            <Ionicons name="people" size={12} color="#94A3B8" />{" "}
                            {crew.memberCount}명
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={s.rankRight}>
                      <Text style={s.crewDistance}>{crew.distance}</Text>
                      <Text style={s.distanceUnit}>km</Text>
                    </View>
                  </TouchableOpacity>
                );
              });
            })()}
          </View>

          <View style={s.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerRight: {
    width: 40,
  },

  // Filter
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterButtonActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "500",
    color: "#64748B",
  },

  scrollView: {
    flex: 1,
  },

  // Podium
  podiumSection: {
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 16,
  },
  podiumItem: {
    flex: 1,
    alignItems: "center",
  },
  podiumFirst: {
    transform: [{ translateY: -16 }],
  },
  crownContainer: {
    marginBottom: 8,
  },
  crown: {
    fontSize: 32,
  },
  podiumRank: {
    marginBottom: 8,
  },
  podiumMedal: {
    fontSize: 32,
  },
  podiumAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#E2E8F0",
  },
  podiumAvatar1: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderColor: "#F59E0B",
    borderWidth: 4,
  },
  podiumAvatar2: {
    borderColor: "#94A3B8",
  },
  podiumAvatar3: {
    borderColor: "#EA580C",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
  },
  podiumName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  podiumName1: {
    fontSize: 16,
    fontWeight: "800",
  },
  podiumDistance: {
    fontSize: 16,
    fontWeight: "800",
    color: "#475569",
  },
  podiumDistance1: {
    fontSize: 20,
    color: "#F59E0B",
  },

  // List
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  rankLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: "800",
  },
  crewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  crewMembers: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },
  rankRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  crewDistance: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  distanceUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  bottomSpacer: {
    height: 40,
  },
});
