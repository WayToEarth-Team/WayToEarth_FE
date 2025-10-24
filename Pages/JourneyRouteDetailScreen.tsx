import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, ActivityIndicator } from 'react-native';
import useRouteDetail from '../hooks/journey/useJourneyRouteDetail';
import { getJourneyRoutes, type RouteId, type JourneyRoute } from '../utils/api/journeyRoutes';
import { getJourneyLandmarks } from '../utils/api/landmarks';
import type { LandmarkSummary as JourneyLandmark } from '../types/landmark';
import ImageCarousel from '../components/Common/ImageCarousel';

type RouteParams = { route: { params?: { id?: RouteId } } ; navigation?: any };

export default function RouteDetailScreen({ route, navigation }: RouteParams) {
  const id = route?.params?.id;
  const { data, loading } = useRouteDetail(id);
  const [showLandmarks, setShowLandmarks] = useState(false);

  // API 데이터 상태
  const [routeData, setRouteData] = useState<JourneyRoute[]>([]);
  const [landmarkData, setLandmarkData] = useState<JourneyLandmark[]>([]);
  const [loadingJourneyData, setLoadingJourneyData] = useState(false);

  // 여정 데이터 로드
  useEffect(() => {
    if (!id) return;

    setLoadingJourneyData(true);
    Promise.all([
      getJourneyRoutes(id),
      getJourneyLandmarks(Number(id)),
    ])
      .then(([routes, landmarks]) => {
        setRouteData(routes);
        setLandmarkData(landmarks);
      })
      .catch((err) => {
        console.error('여정 데이터 로드 실패:', err);
      })
      .finally(() => {
        setLoadingJourneyData(false);
      });
  }, [id]);

  // 랜드마크 이미지 URL 수집 (메모이제이션)
  const landmarkImages = useMemo(() => {
    return landmarkData
      .map((lm) => lm.imageUrl)
      .filter((url): url is string => url !== null && url !== undefined && url.trim() !== '');
  }, [landmarkData]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1F2937" />

      <View style={styles.headerContainer}>
        {/* 배경 이미지 캐러셀 */}
        <ImageCarousel
          images={landmarkImages}
          height={300}
          borderRadius={0}
          autoPlayInterval={4000}
          showGradient={true}
        />

        {/* 오버레이 컨텐츠 */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuIcon}>⋯</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{data?.title ?? '여정 상세'}</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>역사 탐방</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <Text style={{ padding: 16, color: '#6B7280' }}>로딩 중...</Text>
        )}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>여정 소개</Text>
          <Text style={styles.description}>{data?.description ?? '설명이 없습니다.'}</Text>

          <Text style={styles.sectionTitle}>주요 랜드마크</Text>

          <View style={styles.landmarksPreview}>
            {(data?.landmarks || []).slice(0, 3).map((lm, idx) => (
              <View key={lm.id} style={styles.landmarkItem}>
                <View style={styles.landmarkNumber}>
                  <Text style={styles.landmarkNumberText}>{idx + 1}</Text>
                </View>
                <View style={styles.landmarkInfo}>
                  <Text style={styles.landmarkName}>{lm.name}</Text>
                  <Text style={styles.landmarkDistance}>{lm.distance}</Text>
                </View>
                {lm.completed && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedIcon}>✓</Text>
                  </View>
                )}
              </View>
            ))}

            {(data?.landmarks?.length || 0) > 3 && (
              <TouchableOpacity style={styles.showMoreButton} onPress={() => setShowLandmarks(true)}>
                <Text style={styles.showMoreText}>+{(data?.landmarks?.length || 0) - 3}개 더 보기</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          disabled={loadingJourneyData || routeData.length === 0}
          onPress={() => {
            if (!id || !data) return;

            // API 데이터를 JourneyRunningScreen에 전달할 형식으로 변환
            const totalDistanceKm = parseFloat(data.distance.replace('Km', '').replace('km', ''));

            const journeyData = {
              journeyId: String(id),
              journeyTitle: data.title,
              totalDistanceKm,
              landmarks: landmarkData.map((lm) => {
                // 일부 환경: distanceFromStart가 '정수 km'로 내려옴(예: 2,4,6,10)
                const raw = Number(lm.distanceFromStart ?? 0);
                const looksLikeIntegerKm = raw > 0 && raw <= totalDistanceKm + 1 && Math.abs(raw - Math.round(raw)) < 1e-9;
                const meters = looksLikeIntegerKm ? raw * 1000 : raw;
                return {
                  id: String(lm.id),
                  name: lm.name,
                  distance: `${(meters / 1000).toFixed(1)}km 지점`,
                  distanceM: meters,
                  position: {
                    latitude: lm.latitude,
                    longitude: lm.longitude,
                  },
                };
              }),
              journeyRoute: routeData
                .sort((a, b) => a.sequence - b.sequence)
                .map((r) => ({
                  latitude: r.latitude,
                  longitude: r.longitude,
                })),
            };

            navigation?.navigate?.('JourneyRunningScreen', journeyData);
          }}
        >
          {loadingJourneyData ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>여정 계속하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showLandmarks} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>주요 랜드마크</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowLandmarks(false)}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {(data?.landmarks || []).map((lm, idx) => (
              <View key={lm.id} style={styles.modalLandmarkItem}>
                <View style={[styles.landmarkNumber, lm.completed && styles.completedLandmarkNumber]}>
                  <Text style={[styles.landmarkNumberText, lm.completed && styles.completedLandmarkNumberText]}>{lm.completed ? '✓' : idx + 1}</Text>
                </View>
                <View style={styles.landmarkInfo}>
                  <Text style={[styles.landmarkName, lm.completed && styles.completedLandmarkName]}>{lm.name}</Text>
                  <Text style={styles.landmarkDistance}>{lm.distance}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.modalStartButton}
            onPress={() => {
              setShowLandmarks(false);

              // 한국의 고궁탐방 여정 (실제 위치 기반)
              const palaceJourney = {
                journeyId: id || '1',
                journeyTitle: data?.title ?? '한국의 고궁탐방',
                totalDistanceKm: 12.5,
                landmarks: [
                  {
                    id: '1',
                    name: '경복궁',
                    distance: '0km 지점',
                    distanceM: 0,
                    position: { latitude: 37.5796, longitude: 126.9770 },
                  },
                  {
                    id: '2',
                    name: '청와대',
                    distance: '1.2km 지점',
                    distanceM: 1200,
                    position: { latitude: 37.5869, longitude: 126.9744 },
                  },
                  {
                    id: '3',
                    name: '창덕궁',
                    distance: '3.5km 지점',
                    distanceM: 3500,
                    position: { latitude: 37.5794, longitude: 126.9910 },
                  },
                  {
                    id: '4',
                    name: '창경궁',
                    distance: '4.8km 지점',
                    distanceM: 4800,
                    position: { latitude: 37.5788, longitude: 126.9950 },
                  },
                  {
                    id: '5',
                    name: '종묘',
                    distance: '6.5km 지점',
                    distanceM: 6500,
                    position: { latitude: 37.5742, longitude: 126.9944 },
                  },
                  {
                    id: '6',
                    name: '서울역사박물관',
                    distance: '9.2km 지점',
                    distanceM: 9200,
                    position: { latitude: 37.5700, longitude: 126.9690 },
                  },
                  {
                    id: '7',
                    name: '덕수궁',
                    distance: '10.5km 지점',
                    distanceM: 10500,
                    position: { latitude: 37.5658, longitude: 126.9751 },
                  },
                  {
                    id: '8',
                    name: '숭례문',
                    distance: '12.5km 지점',
                    distanceM: 12500,
                    position: { latitude: 37.5605, longitude: 126.9753 },
                  },
                ],
                journeyRoute: [
                  // 경복궁 시작
                  { latitude: 37.5796, longitude: 126.9770 },
                  { latitude: 37.5810, longitude: 126.9765 },
                  { latitude: 37.5830, longitude: 126.9760 },
                  { latitude: 37.5850, longitude: 126.9755 },
                  // 청와대
                  { latitude: 37.5869, longitude: 126.9744 },
                  { latitude: 37.5860, longitude: 126.9780 },
                  { latitude: 37.5840, longitude: 126.9820 },
                  { latitude: 37.5820, longitude: 126.9860 },
                  { latitude: 37.5805, longitude: 126.9890 },
                  // 창덕궁
                  { latitude: 37.5794, longitude: 126.9910 },
                  { latitude: 37.5792, longitude: 126.9925 },
                  { latitude: 37.5790, longitude: 126.9940 },
                  // 창경궁
                  { latitude: 37.5788, longitude: 126.9950 },
                  { latitude: 37.5780, longitude: 126.9950 },
                  { latitude: 37.5765, longitude: 126.9948 },
                  { latitude: 37.5750, longitude: 126.9946 },
                  // 종묘
                  { latitude: 37.5742, longitude: 126.9944 },
                  { latitude: 37.5730, longitude: 126.9920 },
                  { latitude: 37.5715, longitude: 126.9880 },
                  { latitude: 37.5705, longitude: 126.9820 },
                  { latitude: 37.5700, longitude: 126.9760 },
                  { latitude: 37.5700, longitude: 126.9720 },
                  // 서울역사박물관
                  { latitude: 37.5700, longitude: 126.9690 },
                  { latitude: 37.5690, longitude: 126.9710 },
                  { latitude: 37.5675, longitude: 126.9735 },
                  // 덕수궁
                  { latitude: 37.5658, longitude: 126.9751 },
                  { latitude: 37.5645, longitude: 126.9752 },
                  { latitude: 37.5625, longitude: 126.9753 },
                  // 숭례문 (종료)
                  { latitude: 37.5605, longitude: 126.9753 },
                ],
              };

              navigation?.navigate?.('JourneyRunningScreen', palaceJourney);
            }}
          >
            <Text style={styles.modalStartButtonText}>여정 계속하기</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerContainer: {
    height: 300,
    position: 'relative',
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(10px)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  menuButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(10px)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  headerContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  headerBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  content: { flex: 1 },
  infoCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 },
  description: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  landmarksPreview: {},
  landmarkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  landmarkNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  landmarkNumberText: { color: '#6366F1', fontWeight: '800' },
  landmarkInfo: { flex: 1 },
  landmarkName: { fontSize: 14, color: '#111827', fontWeight: '700' },
  landmarkDistance: { fontSize: 12, color: '#6B7280' },
  completedBadge: { backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  completedIcon: { color: '#fff', fontWeight: '800' },
  showMoreButton: { marginTop: 8, backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  showMoreText: { color: '#6366F1', fontWeight: '700' },
  startButton: { margin: 16, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  closeButton: { position: 'absolute', right: 12, top: 10, padding: 8 },
  closeIcon: { fontSize: 16, color: '#6B7280' },
  modalContent: { paddingHorizontal: 16 },
  modalLandmarkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  completedLandmarkNumber: { backgroundColor: '#10B981' },
  completedLandmarkNumberText: { color: '#fff', fontWeight: '800' },
  completedLandmarkName: { color: '#10B981' },
  modalStartButton: { margin: 16, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalStartButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
