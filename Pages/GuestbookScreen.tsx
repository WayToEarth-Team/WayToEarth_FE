// Pages/GuestbookScreen.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getRecentGuestbooks,
  getGuestbookErrorMessage,
} from "../utils/api/guestbook";
import type {
  GuestbookResponse,
  PageableResponse,
} from "../types/guestbook";

/**
 * 방명록 피드 화면
 * - 최근 작성된 공개 방명록 목록 표시 (모든 랜드마크)
 * - 무한 스크롤 페이징
 * - Pull to Refresh
 * - 인스타그램 피드 스타일
 */
export default function GuestbookScreen({ navigation }: { navigation?: any }) {
  const [guestbooks, setGuestbooks] = useState<GuestbookResponse[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuestbooks();
  }, [page]);

  const loadGuestbooks = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const response: PageableResponse<GuestbookResponse> =
        await getRecentGuestbooks(page, 20);

      if (page === 0) {
        setGuestbooks(response.content);
      } else {
        setGuestbooks((prev) => [...prev, ...response.content]);
      }

      setHasMore(!response.last);
    } catch (err: any) {
      console.error("[Guestbook] 조회 실패:", err);
      setError(getGuestbookErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    // page가 0이면 직접 로드, 그렇지 않으면 page를 0으로 리셋하여 useEffect 트리거
    if (page === 0) {
      loadGuestbooks();
    } else {
      setPage(0);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString("ko-KR");
  };

  const handleItemPress = (item: GuestbookResponse) => {
    // 랜드마크별 방명록 화면으로 이동
    navigation?.navigate("LandmarkGuestbookScreen", {
      landmarkId: item.landmark.id,
      landmarkName: item.landmark.name,
    });
  };

  const renderGuestbookItem = ({
    item,
  }: {
    item: GuestbookResponse;
  }) => (
    <TouchableOpacity
      style={styles.guestbookItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.8}
    >
      {/* 사용자 정보 헤더 */}
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: item.user.profileImageUrl }}
            style={styles.profileImage}
          />
          <View style={styles.userDetails}>
            <Text style={styles.nickname}>{item.user.nickname}</Text>
            <Text style={styles.timestamp}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* 랜드마크 정보 배지 */}
      <View style={styles.landmarkBadge}>
        <View style={styles.landmarkBadgeLeft}>
          <View style={styles.decorativeDot} />
          <View style={styles.decorativeDot} />
          <View style={styles.decorativeDot} />
        </View>
        <View style={styles.landmarkBadgeContent}>
          <Ionicons name="location-outline" size={16} color="#8b4513" style={{ marginRight: 4 }} />
          <Text style={styles.landmarkName} numberOfLines={1}>
            {item.landmark.name}
          </Text>
          <Text style={styles.landmarkLocation}>
            {item.landmark.cityName}, {item.landmark.countryCode}
          </Text>
        </View>
      </View>

      {/* 메시지 */}
      <Text style={styles.message}>{item.message}</Text>

      {/* 랜드마크 이미지 */}
      {item.landmark.imageUrl ? (
        <Image
          source={{ uri: item.landmark.imageUrl }}
          style={styles.landmarkImage}
        />
      ) : (
        <View style={[styles.landmarkImage, styles.landmarkImagePlaceholder]}>
          <Ionicons name="image-outline" size={64} color="#9CA3AF" />
        </View>
      )}

      {/* 하단 장식선 */}
      <View style={styles.decorativeLines}>
        <View style={styles.decorativeLine} />
        <View style={styles.decorativeLine} />
        <View style={styles.decorativeLine} />
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerCard}>
      {/* 왼쪽 장식 패널 */}
      <View style={styles.decorativePanel}>
        <View style={styles.decorativePanelLine} />
        <View style={styles.decorativePanelLine} />
        <View style={styles.decorativePanelLine} />
      </View>

      {/* 정보 영역 */}
      <View style={styles.headerContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="globe-outline" size={18} color="#8b4513" />
          <Text style={styles.headerEmojiText}>여행자들의 이야기</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          다른 러너들의 여행 이야기를 확인해보세요
        </Text>
        <Text style={styles.headerCount}>최신 방명록</Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    // 당김 새로고침 중이거나 첫 로딩 중이면 스피너 표시
    if ((loading && page === 0) || refreshing) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8b4513" />
          <Text style={styles.loadingText}>방명록을 불러오는 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#a0522d" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document-text-outline" size={40} color="#a0522d" style={{ marginBottom: 8 }} />
        <Text style={styles.emptyText}>아직 작성된 방명록이 없습니다.</Text>
        <Text style={styles.emptySubText}>
          랜드마크를 방문하고 첫 방명록을 남겨보세요!
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || page === 0) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#8b4513" />
        <Text style={styles.footerText}>더 불러오는 중...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>방명록 피드</Text>
      </View>

      {/* 방명록 목록 */}
      <FlatList
        data={guestbooks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGuestbookItem}
        ListHeaderComponent={guestbooks.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b4513"
          />
        }
        contentContainerStyle={
          guestbooks.length === 0 ? styles.emptyListContainer : styles.listContent
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f3f0",
  },
  header: {
    backgroundColor: "#f5f3f0",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d4af37",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#8b4513",
  },
  headerCard: {
    backgroundColor: "#8b4513",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    height: 130,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    overflow: "hidden",
  },
  decorativePanel: {
    width: 60,
    backgroundColor: "#654321",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  decorativePanelLine: {
    width: 30,
    height: 2,
    backgroundColor: "#d4af37",
  },
  headerContent: {
    flex: 1,
    backgroundColor: "#f4f1e8",
    padding: 20,
    justifyContent: "space-between",
  },
  headerEmojiText: { fontSize: 18, fontWeight: "700", color: "#8b4513" },
  headerSubtitle: {
    fontSize: 14,
    color: "#a0522d",
    marginTop: 4,
  },
  headerCount: {
    fontSize: 12,
    color: "#8b4513",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: "#a0522d",
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b4513",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#8b4513",
    borderRadius: 25,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8b4513",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#a0522d",
    textAlign: "center",
    lineHeight: 20,
  },
  guestbookItem: {
    backgroundColor: "#fffef7",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#d4af37",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  userHeader: {
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e9ecef",
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  nickname: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b4513",
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: "#a0522d",
  },
  landmarkBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b4513",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    height: 50,
  },
  landmarkBadgeLeft: {
    width: 40,
    backgroundColor: "#654321",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  decorativeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d4af37",
  },
  landmarkBadgeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f1e8",
    height: "100%",
    paddingHorizontal: 12,
    gap: 6,
  },
  landmarkIcon: { fontSize: 16 },
  landmarkName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8b4513",
    flex: 1,
  },
  landmarkLocation: {
    fontSize: 12,
    color: "#a0522d",
    fontStyle: "italic",
  },
  message: {
    fontSize: 15,
    color: "#5d4037",
    lineHeight: 22,
    marginBottom: 12,
  },
  landmarkImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#e9ecef",
    marginTop: 4,
  },
  landmarkImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f1e8",
  },
  landmarkImageEmoji: { fontSize: 64 },
  decorativeLines: {
    position: "absolute",
    right: 16,
    bottom: 16,
    gap: 3,
    alignItems: "flex-end",
  },
  decorativeLine: {
    width: 40,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#a0522d",
    marginTop: 8,
  },
});
