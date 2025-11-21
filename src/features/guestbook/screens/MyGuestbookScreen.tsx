import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMyGuestbooks,
  getGuestbookErrorMessage,
} from "@utils/api/guestbook";
import { getMyProfile } from "@utils/api/users";
import type { GuestbookResponse } from "@types/guestbook";

interface MyGuestbookScreenProps {
  route: {
    params?: {
      userId?: number;
    };
  };
  navigation: any;
}

export default function MyGuestbookScreen({
  route,
  navigation,
}: MyGuestbookScreenProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [guestbooks, setGuestbooks] = useState<GuestbookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const paramUserId = route.params?.userId;
        if (paramUserId) {
          setUserId(paramUserId);
        } else {
          const profile = await getMyProfile();
          setUserId(profile.id);
        }
      } catch (err) {
        console.error("[MyGuestbook] 사용자 프로필 로드 실패:", err);
        setError("사용자 정보를 불러올 수 없습니다.");
      }
    })();
  }, []);

  useEffect(() => {
    if (userId) {
      loadGuestbooks();
    }
  }, [userId]);

  const loadGuestbooks = async () => {
    if (loading || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getMyGuestbooks(userId);
      setGuestbooks(response);
    } catch (err: any) {
      console.error("[MyGuestbook] 조회 실패:", err);
      setError(getGuestbookErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadGuestbooks();
  };

  const handleItemPress = (item: GuestbookResponse) => {
    navigation.navigate("LandmarkGuestbookScreen", {
      landmarkId: item.landmark.id,
      landmarkName: item.landmark.name,
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const renderGuestbookItem = ({
    item,
    index,
  }: {
    item: GuestbookResponse;
    index: number;
  }) => (
    <TouchableOpacity
      style={s.card}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      {/* 이미지 섹션 */}
      <View style={s.imageContainer}>
        {item.landmark.imageUrl ? (
          <Image
            source={{ uri: item.landmark.imageUrl }}
            style={s.landmarkImage}
          />
        ) : (
          <LinearGradient
            colors={["#A855F7", "#EC4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.landmarkImage}
          >
            <Ionicons name="location" size={48} color="rgba(255,255,255,0.5)" />
          </LinearGradient>
        )}

        {/* 이미지 오버레이 */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={s.imageOverlay}
        >
          <View style={s.locationBadge}>
            <Ionicons name="location-sharp" size={12} color="#fff" />
            <Text style={s.locationText} numberOfLines={1}>
              {item.landmark.cityName}
            </Text>
          </View>
        </LinearGradient>

        {/* 공개/비공개 배지 */}
        <View style={s.statusBadge}>
          <Ionicons
            name={item.isPublic ? "eye" : "eye-off"}
            size={14}
            color={item.isPublic ? "#10B981" : "#6B7280"}
          />
        </View>
      </View>

      {/* 콘텐츠 섹션 */}
      <View style={s.cardContent}>
        <View style={s.titleRow}>
          <Text style={s.landmarkName} numberOfLines={1}>
            {item.landmark.name}
          </Text>
          <Text style={s.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        <Text style={s.message} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={s.footer}>
          <View style={s.countryBadge}>
            <Text style={s.countryText}>{item.landmark.countryCode}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={s.statsCard}>
      <LinearGradient
        colors={["#6366F1", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.statsGradient}
      >
        <View style={s.statsContent}>
          <View style={s.statsIcon}>
            <Ionicons name="book" size={32} color="#fff" />
          </View>
          <View style={s.statsText}>
            <Text style={s.statsTitle}>나의 여행 기록</Text>
            <Text style={s.statsCount}>{guestbooks.length}개의 방명록</Text>
          </View>
        </View>

        {/* 장식 요소 */}
        <View style={s.decoration}>
          <View style={s.decorationCircle} />
          <View style={[s.decorationCircle, { opacity: 0.6 }]} />
          <View style={[s.decorationCircle, { opacity: 0.3 }]} />
        </View>
      </LinearGradient>
    </View>
  );

  const renderEmpty = () => {
    if (loading || refreshing) {
      return (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loadingText}>방명록을 불러오는 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={s.centerContainer}>
          <View style={s.errorIconBg}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
          </View>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={s.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.centerContainer}>
        <View style={s.emptyIconBg}>
          <Ionicons name="book-outline" size={64} color="#9CA3AF" />
        </View>
        <Text style={s.emptyTitle}>아직 방명록이 없습니다</Text>
        <Text style={s.emptyText}>
          랜드마크를 방문하고{"\n"}첫 방명록을 남겨보세요!
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={s.container}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>내 방명록</Text>
          {guestbooks.length > 0 && (
            <Text style={s.headerSubtitle}>총 {guestbooks.length}개</Text>
          )}
        </View>
        <View style={s.headerSpacer} />
      </View>

      {/* 리스트 */}
      <FlatList
        data={guestbooks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGuestbookItem}
        ListHeaderComponent={guestbooks.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
        contentContainerStyle={
          guestbooks.length === 0 ? s.emptyListContainer : s.listContent
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  headerSpacer: {
    width: 40,
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  statsGradient: {
    padding: 24,
    position: "relative",
    overflow: "hidden",
  },
  statsContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    zIndex: 1,
  },
  statsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsText: {
    flex: 1,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statsCount: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  decoration: {
    display: 'none',
  },
  decorationCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 16,
    fontWeight: "500",
  },
  errorIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 180,
  },
  landmarkImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: "flex-end",
    padding: 12,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  locationText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  landmarkName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    marginRight: 8,
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  countryBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
  },
});
