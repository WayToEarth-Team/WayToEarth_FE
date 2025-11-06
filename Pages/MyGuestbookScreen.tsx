// Pages/MyGuestbookScreen.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMyGuestbooks,
  getGuestbookErrorMessage,
} from "../utils/api/guestbook";
import { getMyProfile } from "../utils/api/users";
import type { GuestbookResponse } from "../types/guestbook";

interface MyGuestbookScreenProps {
  route: {
    params?: {
      userId?: number;
    };
  };
  navigation: any;
}

/**
 * 내 방명록 목록 화면
 * - 내가 작성한 모든 방명록 표시 (공개/비공개 모두)
 * - 페이징 없음 (전체 목록)
 * - Pull to Refresh
 * - 공개/비공개 배지 표시
 */
export default function MyGuestbookScreen({
  route,
  navigation,
}: MyGuestbookScreenProps) {
  const [userId, setUserId] = useState<number | null>(null);

  const [guestbooks, setGuestbooks] = useState<GuestbookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사용자 프로필 로드
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

  // userId가 설정되면 방명록 로드
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
    // 랜드마크별 방명록 화면으로 이동
    navigation.navigate("LandmarkGuestbookScreen", {
      landmarkId: item.landmark.id,
      landmarkName: item.landmark.name,
    });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderGuestbookItem = ({
    item,
    index,
  }: {
    item: GuestbookResponse;
    index: number;
  }) => (
    <TouchableOpacity
      style={styles.guestbookItem}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      {/* 랜드마크 이미지 */}
      {item.landmark.imageUrl ? (
        <Image
          source={{ uri: item.landmark.imageUrl }}
          style={styles.landmarkImage}
        />
      ) : (
        <View style={[styles.landmarkImage, styles.landmarkImagePlaceholder]}>
          <Text style={styles.landmarkImageEmoji}>🏯</Text>
        </View>
      )}

      {/* 내용 */}
      <View style={styles.itemContent}>
        {/* 번호 배지 */}
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{guestbooks.length - index}</Text>
        </View>

        {/* 랜드마크 정보 */}
        <View style={styles.landmarkInfo}>
          <Text style={styles.landmarkName} numberOfLines={1}>
            🏯 {item.landmark.name}
          </Text>
          <Text style={styles.landmarkLocation}>
            {item.landmark.cityName}, {item.landmark.countryCode}
          </Text>
        </View>

        {/* 메시지 */}
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>

        {/* 하단 메타 정보 */}
        <View style={styles.meta}>
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>

          {/* 공개/비공개 배지 */}
          <View
            style={[
              styles.badge,
              item.isPublic ? styles.badgePublic : styles.badgePrivate,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                item.isPublic ? styles.badgeTextPublic : styles.badgeTextPrivate,
              ]}
            >
              {item.isPublic ? "공개" : "비공개"}
            </Text>
          </View>
        </View>

        {/* 하단 장식선 */}
        <View style={styles.decorativeLines}>
          <View style={styles.decorativeLine} />
          <View style={styles.decorativeLine} />
          <View style={styles.decorativeLine} />
        </View>
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
        <Text style={styles.headerEmoji}>📖 나의 여행 기록</Text>
        <Text style={styles.headerSubtitle}>방문한 랜드마크들</Text>
        <Text style={styles.headerCount}>총 {guestbooks.length}개의 기록</Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading && !refreshing) {
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
          <Text style={styles.errorIcon}>😅</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📝</Text>
        <Text style={styles.emptyText}>
          아직 작성한 방명록이 없습니다.
        </Text>
        <Text style={styles.emptySubText}>
          랜드마크를 방문하고 첫 방명록을 남겨보세요!
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>내 방명록</Text>
          {guestbooks.length > 0 && (
            <Text style={styles.headerSubtitleText}>
              총 {guestbooks.length}개
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* 방명록 목록 */}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f3f0",
    paddingHorizontal: 20,
    paddingVertical: 20,
    height: 80,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 18,
    color: "#8b4513",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8b4513",
    marginBottom: 2,
  },
  headerSubtitleText: {
    fontSize: 12,
    color: "#a0522d",
  },
  headerSpacer: {
    width: 40,
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
  headerEmoji: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8b4513",
    lineHeight: 32,
  },
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
  emptyListContainer: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 20,
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
    borderRadius: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#d4af37",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  landmarkImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#e9ecef",
  },
  landmarkImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f1e8",
  },
  landmarkImageEmoji: {
    fontSize: 64,
  },
  itemContent: {
    padding: 16,
  },
  numberBadge: {
    position: "absolute",
    right: 16,
    top: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#8b4513",
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  landmarkInfo: {
    marginBottom: 12,
  },
  landmarkName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b4513",
    marginBottom: 2,
  },
  landmarkLocation: {
    fontSize: 13,
    color: "#a0522d",
    fontStyle: "italic",
  },
  message: {
    fontSize: 15,
    color: "#5d4037",
    lineHeight: 22,
    marginBottom: 12,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timestamp: {
    fontSize: 13,
    color: "#a0522d",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePublic: {
    backgroundColor: "#8b4513",
  },
  badgePrivate: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d4af37",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextPublic: {
    color: "#fff",
  },
  badgeTextPrivate: {
    color: "#8b4513",
  },
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
});
