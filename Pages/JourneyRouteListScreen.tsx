import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useRouteList from "../hooks/journey/useJourneyRouteList";
import type { RouteSummary } from "../utils/api/journeyRoutes";
import { getJourneyLandmarks } from '../utils/api/landmarks';
import ImageCarousel from '../components/Common/ImageCarousel';

export default function RouteListScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState('전체');
  const { data: routes, loading } = useRouteList();
  const [journeyImages, setJourneyImages] = useState<Record<string, string[]>>({});

  // 각 여정의 랜드마크 이미지 로드
  useEffect(() => {
    if (!routes || routes.length === 0) return;

    const loadJourneyImages = async () => {
      const imagesMap: Record<string, string[]> = {};

      for (const route of routes) {
        try {
          const landmarks = await getJourneyLandmarks(Number(route.id));
          const imageUrls = landmarks
            .map(lm => lm.imageUrl)
            .filter((url): url is string => url !== null && url !== undefined && url.trim() !== '');

          if (imageUrls.length > 0) {
            imagesMap[String(route.id)] = imageUrls;
          }
        } catch (err) {
          console.error(`[RouteList] 여정 ${route.id} 이미지 로드 실패:`, err);
        }
      }

      setJourneyImages(imagesMap);
    };

    loadJourneyImages();
  }, [routes]);

  const tabs = ['전체', '국내 여행', '해외 여행'];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case '쉬움':
        return '#10B981';
      case '보통':
        return '#F59E0B';
      case '어려움':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getProgressPercentage = (route: RouteSummary | any) => {
    const p = Number(route?.userProgressPercent ?? NaN);
    if (Number.isFinite(p)) return Math.round(Math.max(0, Math.min(100, p)));
    // fallback to legacy ratio if present
    const completed = Number((route as any).completed ?? 0);
    const total = Number((route as any).total ?? 0);
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>여정 리스트</Text>
          <TouchableOpacity
            style={styles.guestbookButton}
            onPress={() => navigation?.navigate?.('GuestbookScreen')}
          >
            <Text style={styles.guestbookIcon}>📝</Text>
            <Text style={styles.guestbookText}>방명록</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <Text style={{ padding: 16, color: '#6B7280' }}>로딩 중...</Text>
        )}
        {((routes ?? []) as RouteSummary[]).map((route: RouteSummary) => {
          // 여정의 랜드마크 이미지 사용
          const carouselImages = journeyImages[String(route.id)] || [];

          return (
            <TouchableOpacity
              key={route.id}
              style={styles.routeCard}
              onPress={() => navigation?.navigate?.('JourneyRouteDetail', { id: route.id })}
            >
              <View style={styles.routeImageContainer}>
                <ImageCarousel
                  images={carouselImages}
                  height={200}
                  borderRadius={0}
                  autoPlayInterval={4000}
                />
                <View style={styles.progressBadge}>
                  <Text style={styles.progressText}>{getProgressPercentage(route)}% 완료</Text>
                </View>
                <TouchableOpacity style={styles.favoriteButton}>
                  <Text style={styles.favoriteIcon}>역사 탐방</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.routeInfo}>
                <Text style={styles.routeTitle}>{route.title ?? ''}</Text>
                <Text style={styles.routeDescription} numberOfLines={3}>
                  {route.description ?? ''}
                </Text>

                <View style={styles.routeTags}>
                  {(route.tags ?? []).map((tag, index) => (
                    <View key={`${route.id}-tag-${index}`} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.routeStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{route.distance ?? ''}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{route.duration ?? ''}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: getDifficultyColor(String(route.difficulty ?? '')) }]}>{route.difficulty ?? ''}</Text>
                  </View>
                </View>

                <Text style={styles.participantCount}>
                  함께한 러너 {Number(route.runningTogether ?? 0).toLocaleString()}명
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  guestbookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b4513',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  guestbookIcon: {
    fontSize: 16,
  },
  guestbookText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  tabContainer: { flexDirection: 'row' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderRadius: 20 },
  activeTab: { backgroundColor: '#EEF2FF' },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  activeTabText: { color: '#6366F1', fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20 },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  routeImageContainer: { height: 200, backgroundColor: '#1F2937', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  routeImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  routeImagePlaceholder: { fontSize: 48 },
  progressBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  progressText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  favoriteButton: { position: 'absolute', top: 12, right: 12, backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  favoriteIcon: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  routeInfo: { padding: 16 },
  routeTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  routeDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  routeTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tag: { backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8, marginBottom: 4 },
  tagText: { fontSize: 12, color: '#6366F1', fontWeight: '500' },
  routeStats: { flexDirection: 'row', marginBottom: 8 },
  statItem: { marginRight: 16 },
  statValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  participantCount: { fontSize: 12, color: '#9CA3AF' },
  completedCount: { color: '#6366F1', fontWeight: '500' },
});
