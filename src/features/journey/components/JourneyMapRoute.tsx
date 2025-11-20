import React, { useEffect, useRef, useState, useMemo } from "react";
import MapView, {
  Marker,
  Polyline,
  LatLng as RNLatLng,
} from "react-native-maps";
import { StyleSheet, View, Text, Pressable, Animated, Image } from "react-native";
import type { LatLng } from "@types/types";
import * as Location from "expo-location";

type JourneyLandmark = {
  id: string;
  name: string;
  position: LatLng;
  distance: string;
  reached: boolean;
};

type Props = {
  // 여정 경로 (미리 정의된 전체 경로)
  journeyRoute: LatLng[];
  // 랜드마크 목록
  landmarks: JourneyLandmark[];
  // 사용자 현재 러닝 경로
  userRoute: LatLng[];
  // 현재 위치 (가상 위치)
  currentLocation: LatLng | null;
  // 진행률 (0~100)
  progressPercent: number;
  // 가상 경로 인덱스 (거리 기반)
  virtualRouteIndex?: number;
  // 현재 위치 마커에 표시할 아바타 이미지 URL (있으면 아바타로 표시)
  currentAvatarUrl?: string;
  // 아바타 이미지 로드 콜백(옵션)
  onAvatarLoaded?: () => void;
  onAvatarError?: (e?: any) => void;
  // 지도 준비 완료 콜백
  onMapReady?: () => void;
  // 스냅샷 바인딩
  onBindSnapshot?: (fn: () => Promise<string | null>) => void;
  onBindCenter?: (fn: () => void) => void;
  centerSignal?: number;
  // 랜드마크 마커 클릭 콜백
  onLandmarkPress?: (landmark: JourneyLandmark) => void;
};

// 개별 랜드마크 마커 컴포넌트(메모이제이션으로 깜빡임/불필요 렌더 방지)
const LandmarkMarkerItem = React.memo(function LandmarkMarkerItem({
  landmark,
  index,
  onPress,
}: {
  landmark: JourneyLandmark;
  index: number;
  onPress?: (lm: JourneyLandmark) => void;
}) {
  const prevReachedRef = React.useRef<boolean>(landmark.reached);
  const scale = React.useRef(new Animated.Value(1)).current;
  const [tracks, setTracks] = React.useState(false);

  React.useEffect(() => {
    // 최초로 reached가 true로 전환될 때만 축하 애니메이션 (해당 마커만)
    if (!prevReachedRef.current && landmark.reached) {
      setTracks(true); // 애니메이션 동안만 뷰 갱신 허용
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.25,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 약간의 지연 후 뷰 스냅샷 고정(안드로이드 지도 갱신 안정화)
        setTimeout(() => setTracks(false), 200);
      });
    }
    prevReachedRef.current = landmark.reached;
  }, [landmark.reached, scale]);

  return (
    <Marker
      key={`lmk-${landmark.id}`}
      coordinate={landmark.position as RNLatLng}
      title={landmark.name}
      description={landmark.distance}
      onPress={() => onPress?.(landmark)}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
    >
      {/* 모던한 핀 스타일 마커 */}
      <View
        style={[
          styles.markerContainer,
          // 확대 애니메이션 시 잘림 방지를 위해 여유 공간 확보
          { padding: 10, marginBottom: -10 },
        ]}
      >
        {/* 하단 그림자 */}
        <View style={styles.markerShadow} />

        {/* 메인 핀 (도달 전환 시 스케일 애니메이션) */}
        <Animated.View
          style={[
            styles.pinBody,
            landmark.reached ? styles.pinBodyReached : styles.pinBodyPending,
            { transform: [{ scale }] },
          ]}
        >
          {landmark.reached ? (
            <Text style={styles.pinIcon}>✓</Text>
          ) : (
            <Text style={styles.pinNumber}>{index + 1}</Text>
          )}
        </Animated.View>

        {/* 핀 끝 (삼각형 느낌) */}
        <View
          style={[
            styles.pinTip,
            landmark.reached ? styles.pinTipReached : styles.pinTipPending,
          ]}
        />
      </View>
    </Marker>
  );
}, (prev, next) => {
  const a = prev.landmark, b = next.landmark;
  return (
    a.id === b.id &&
    a.reached === b.reached &&
    a.position.latitude === b.position.latitude &&
    a.position.longitude === b.position.longitude &&
    prev.index === next.index &&
    prev.onPress === next.onPress
  );
});

// 커스텀 지도 스타일 (미니멀 & 깔끔)
const customMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5f5e0" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7cb342" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e7f8" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
];

export default function JourneyMapRoute({
  journeyRoute,
  landmarks,
  userRoute,
  currentLocation,
  progressPercent,
  virtualRouteIndex,
  currentAvatarUrl,
  onAvatarLoaded,
  onAvatarError,
  onBindCenter,
  centerSignal,
  onMapReady,
  onBindSnapshot,
  onLandmarkPress,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasFittedRef = useRef(false);
  const [avatarTracks, setAvatarTracks] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const prevAvatarUrlRef = useRef<string | undefined>(undefined);

  // 가상 위치(진행률 기반 마커)로 이동
  const moveToVirtualLocation = () => {
    if (!currentLocation) {
      // 현재 위치가 없으면 여정 시작점으로 이동
      if (journeyRoute.length > 0) {
        mapRef.current?.animateToRegion(
          {
            latitude: journeyRoute[0].latitude,
            longitude: journeyRoute[0].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          650
        );
      }
      return;
    }

    // 가상 위치(진행률 기반 마커)로 이동
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      650
    );
  };

  // 초기 지도 중심 설정 (여정 시작 지점) - useMemo로 캐싱
  const initialCenter: RNLatLng = useMemo(
    () => journeyRoute[0] || { latitude: 37.5665, longitude: 126.978 },
    [journeyRoute]
  );

  // 초기 영역 계산 - useMemo로 캐싱
  const initialRegion = useMemo(() => {
    if (journeyRoute.length === 0) {
      return {
        latitude: 37.5665,
        longitude: 126.978,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // 경로의 경계 계산
    let minLat = journeyRoute[0].latitude;
    let maxLat = journeyRoute[0].latitude;
    let minLng = journeyRoute[0].longitude;
    let maxLng = journeyRoute[0].longitude;

    journeyRoute.forEach(point => {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.3; // 여백 추가
    const lngDelta = (maxLng - minLng) * 1.3;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  }, [journeyRoute]);

  // 지도 준비 완료 시 한 번만 fitToCoordinates 실행
  useEffect(() => {
    if (!mapReady || journeyRoute.length === 0 || hasFittedRef.current) return;

    hasFittedRef.current = true;

    // 애니메이션 없이 즉시 fit (더 빠름)
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(journeyRoute as RNLatLng[], {
        edgePadding: { top: 100, right: 60, bottom: 160, left: 60 },
        animated: true,
      });
    }, 100); // 300ms → 100ms로 단축
  }, [mapReady]);

  // 스냅샷 바인딩
  useEffect(() => {
    if (!onBindSnapshot) return;
    onBindSnapshot(async () => {
      if (!mapRef.current) return null;
      try {
        const uri = await (mapRef.current as any).takeSnapshot?.({
          width: 700,
          height: 360,
          format: "png",
          result: "file",
          quality: 1,
        });
        return (uri as string) ?? null;
      } catch (e) {
        console.warn("스냅샷 실패:", e);
        return null;
      }
    });
  }, [onBindSnapshot]);

  const handleMapReady = () => {
    setMapReady(true);
    onMapReady?.();
  };

  // 외부로 센터링 함수 바인딩
  useEffect(() => {
    if (!onBindCenter) return;
    onBindCenter(() => moveToVirtualLocation());
  }, [onBindCenter, currentLocation]);

  // 외부 신호로 센터 이동 트리거
  useEffect(() => {
    if (centerSignal == null) return;
    moveToVirtualLocation();
  }, [centerSignal]);

  // RN Maps 마커 이미지 갱신 보장: URL이 바뀔 때 잠시 tracksViewChanges 강제 ON
  useEffect(() => {
    const url = currentAvatarUrl || undefined;
    if (prevAvatarUrlRef.current === url) return;
    prevAvatarUrlRef.current = url;
    if (!url) return;
    setAvatarError(false);
    setAvatarTracks(true);
    const t = setTimeout(() => setAvatarTracks(false), 1500);
    return () => clearTimeout(t);
  }, [currentAvatarUrl]);

  // 📍 최적화: currentLocation 객체 전체 대신 좌표 값만 의존성으로 사용
  const currentLat = currentLocation?.latitude;
  const currentLng = currentLocation?.longitude;

  // 현재 위치가 준비되면 해당 위치로 카메라 이동(초기/변경 시 리센터)
  useEffect(() => {
    if (!mapReady || !currentLocation || !mapRef.current) return;
    try {
      mapRef.current.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } catch {}
  }, [mapReady, currentLat, currentLng]);

  // 🏁 랜드마크 마커 캐싱: landmarks 내용 서명만 의존해 불필요 재생성 방지
  const landmarksSig = useMemo(
    () =>
      landmarks
        .map(
          (l) => `${l.id}:${l.reached ? 1 : 0}:${l.position.latitude.toFixed(6)},${l.position.longitude.toFixed(6)}`
        )
        .join("|"),
    [landmarks]
  );

  const landmarkMarkers = useMemo(() => {
    return landmarks.map((landmark, index) => (
      <LandmarkMarkerItem
        key={`lmk-${landmark.id}`}
        landmark={landmark}
        index={index}
        onPress={onLandmarkPress}
      />
    ));
  }, [landmarksSig, onLandmarkPress]);

  // 진행률에 따라 완료된 경로 구간 계산 (거리 기반 인덱스 사용) - useMemo로 캐싱
  const { completedRoute, remainingRoute } = useMemo(() => {
    if (journeyRoute.length === 0) {
      return { completedRoute: [], remainingRoute: [] };
    }

    // virtualRouteIndex가 있으면 그것을 사용, 없으면 progressPercent 사용
    const exactIndex = virtualRouteIndex !== undefined
      ? virtualRouteIndex
      : (journeyRoute.length - 1) * progressPercent / 100;

    const beforeIndex = Math.floor(exactIndex);
    const afterIndex = Math.min(beforeIndex + 1, journeyRoute.length - 1);

    // ✅ 초록색 선: 시작 ~ beforeIndex + 마커 위치
    let completed = journeyRoute.slice(0, beforeIndex + 1);
    if (currentLocation) {
      completed = [...completed, currentLocation]; // 마커까지 연결
    }

    // ✅ 회색 점선: 마커 위치 ~ 끝
    let remaining = journeyRoute.slice(afterIndex);
    if (currentLocation) {
      remaining = [currentLocation, ...remaining]; // 마커부터 시작
    }

    console.log("[JourneyMapRoute] 경로 계산:", {
      exactIndex: exactIndex.toFixed(2),
      beforeIndex,
      afterIndex,
      completedLength: completed.length,
      remainingLength: remaining.length,
      hasCurrentLocation: !!currentLocation,
    });

    return { completedRoute: completed, remainingRoute: remaining };
  }, [journeyRoute, progressPercent, virtualRouteIndex, currentLat, currentLng]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={customMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={handleMapReady}
        loadingEnabled={false}
        pitchEnabled={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        // 성능 최적화 옵션
        maxZoomLevel={20}
        minZoomLevel={10}
      >
      {/* 완료된 여정 경로 (그라데이션 느낌의 밝은 초록색) */}
      {completedRoute.length > 1 && (
        <>
          {/* 외곽 글로우 레이어 */}
          <Polyline
            coordinates={completedRoute as RNLatLng[]}
            strokeWidth={12}
            strokeColor="rgba(16, 185, 129, 0.3)"
            lineCap="round"
            lineJoin="round"
          />
          {/* 메인 경로 */}
          <Polyline
            coordinates={completedRoute as RNLatLng[]}
            strokeWidth={7}
            strokeColor="#10B981"
            lineCap="round"
            lineJoin="round"
          />
        </>
      )}

      {/* 남은 여정 경로 (보라색 실선) */}
      {remainingRoute.length > 1 && (
        <Polyline
          coordinates={remainingRoute as RNLatLng[]}
          strokeWidth={6}
          strokeColor="#A78BFA"
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* 사용자 실제 러닝 경로 (파란색) */}
      {userRoute.length > 1 && (
        <Polyline
          coordinates={userRoute as RNLatLng[]}
          strokeWidth={5}
          strokeColor="#3B82F6"
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* 랜드마크 마커 (useMemo로 캐싱됨) */}
      {landmarkMarkers}

      {/* 현재 위치 마커 - 아바타(있으면) 또는 펄싱 점 */}
      {currentLocation && (
        <Marker
          coordinate={currentLocation as RNLatLng}
          title="현재 위치"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={currentAvatarUrl ? avatarTracks : false}
        >
          {currentAvatarUrl && !avatarError ? (
            <View style={styles.avatarContainer}>
              {/* 외곽 반투명 링 */}
              <View style={styles.avatarRing} />
              {/* 아바타 이미지 */}
              <Image
                key={currentAvatarUrl}
                source={{ uri: currentAvatarUrl }}
                style={styles.avatarImage}
                resizeMode="cover"
                fadeDuration={0}
                onLoadStart={() => { setAvatarError(false); setAvatarTracks(true); }}
                onLoad={() => { setAvatarTracks(false); try { onAvatarLoaded?.(); } catch {} }}
                onError={(e) => { setAvatarTracks(false); setAvatarError(true); try { console.warn('[JourneyMapRoute] Avatar load error:', e?.nativeEvent); } catch {} try { onAvatarError?.(e?.nativeEvent); } catch {} }}
              />
            </View>
          ) : (
            <View style={styles.currentPosContainer}>
              {/* 외곽 펄스 링 */}
              <View style={styles.pulseRingOuter} />
              <View style={styles.pulseRingInner} />
              {/* 중심 점 */}
              <View style={styles.currentPosDot} />
            </View>
          )}
        </Marker>
      )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  // 🎯 모던한 핀 스타일 마커
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerShadow: {
    position: "absolute",
    bottom: 0,
    width: 16,
    height: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  pinBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  pinBodyReached: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  pinBodyPending: {
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  pinTip: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  pinTipReached: {
    borderTopColor: "#10B981",
  },
  pinTipPending: {
    borderTopColor: "#6366F1",
  },
  pinIcon: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  pinNumber: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  // 📍 현재 위치 마커 (펄싱 디자인)
  currentPosContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  pulseRingInner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  currentPosDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3B82F6",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#3B82F6",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
  },
  // 아바타 마커 스타일
  avatarContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.28)',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    backgroundColor: '#e5e7eb',
  },
});
