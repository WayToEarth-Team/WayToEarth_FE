import React, { useEffect, useRef, useState, useCallback } from "react";
import MapView, {
  Marker,
  Polyline,
  LatLng as RNLatLng,
} from "react-native-maps";
import { StyleSheet, Alert } from "react-native";
import * as Location from "expo-location";
import type { LatLng } from "../../types/types";

type Props = {
  route: LatLng[];
  last: LatLng | null;
  liveMode?: boolean;
  showUserLocation?: boolean;
  showMyLocationButton?: boolean;
  onBindCenter?: (fn: (p: LatLng) => void) => void;
  onBindSnapshot?: (fn: () => Promise<string | null>) => void;
  useCurrentLocationOnMount?: boolean;
  onMapReady?: () => void;
};

export default function MapRoute({
  route,
  last,
  liveMode = true,
  showUserLocation,
  showMyLocationButton,
  onBindCenter,
  onBindSnapshot,
  useCurrentLocationOnMount = true,
  onMapReady,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [initial, setInitial] = useState<RNLatLng | null>(null);
  const [locationLoading, setLocationLoading] = useState(
    useCurrentLocationOnMount
  );

  // 🔒 초기 줌 1회만
  const didInitCamera = useRef(false);
  // 👣 사용자 제스처 시 팔로우 해제
  const followCenter = useRef(true);
  const followResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopFollowingTemporarily = useCallback((ms = 4000) => {
    followCenter.current = false;
    if (followResumeTimer.current) clearTimeout(followResumeTimer.current);
    followResumeTimer.current = setTimeout(() => {
      followCenter.current = true;
    }, ms);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeLocation = async () => {
      if (!useCurrentLocationOnMount) {
        const defaultCenter = (last as RNLatLng) || {
          latitude: 37.5665,
          longitude: 126.978,
        };
        setInitial(defaultCenter);
        setLocationLoading(false);
        onMapReady?.();
        return;
      }

      try {
        setLocationLoading(true);
        console.log('[MapRoute] Checking location permissions...');

        // 먼저 권한 상태 확인 (요청하지 않음)
        let perm = await Location.getForegroundPermissionsAsync();
        console.log('[MapRoute] Current permission status:', perm.status);

        // 권한이 없을 때만 요청
        if (perm.status !== "granted") {
          console.log('[MapRoute] Requesting permissions...');
          perm = await Location.requestForegroundPermissionsAsync();
          console.log('[MapRoute] Permission request result:', perm.status);
        }

        if (perm.status !== "granted") {
          console.warn('[MapRoute] Location permission denied');
          Alert.alert("위치 권한이 필요합니다.");
          const defaultCenter = (last as RNLatLng) || {
            latitude: 37.5665,
            longitude: 126.978,
          };
          setInitial(defaultCenter);
          setLocationLoading(false);
          onMapReady?.();
          return;
        }

        console.log('[MapRoute] Getting current position...');
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        console.log('[MapRoute] Got location:', { lat: loc.coords.latitude, lng: loc.coords.longitude });

        if (!mounted) return;

        const center = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setInitial(center);
        setLocationLoading(false);
        console.log('[MapRoute] Location set successfully');
        onMapReady?.();

        setTimeout(() => {
          if (mounted && mapRef.current) {
            mapRef.current.animateCamera(
              { center, zoom: 16 },
              { duration: 500 }
            );
            didInitCamera.current = true; // 이후로 줌은 건드리지 않음
          }
        }, 100);
      } catch (e) {
        console.error("[MapRoute] 위치 가져오기 실패:", e);

        // 재시도: last known location 사용
        try {
          console.log('[MapRoute] Trying last known location...');
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 60000,
            requiredAccuracy: 100,
          });

          if (lastKnown && mounted) {
            console.log('[MapRoute] Using last known location:', { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
            const center = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            setInitial(center);
            setLocationLoading(false);
            onMapReady?.();
            return;
          }
        } catch (retryErr) {
          console.error('[MapRoute] Last known location also failed:', retryErr);
        }

        console.warn('[MapRoute] Using default Seoul location');
        const defaultCenter = (last as RNLatLng) || {
          latitude: 37.5665,
          longitude: 126.978,
        };
        setInitial(defaultCenter);
        setLocationLoading(false);
        onMapReady?.();
      }
    };

    initializeLocation();
    return () => {
      mounted = false;
      if (followResumeTimer.current) clearTimeout(followResumeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회만 실행 (최적화)

  // 부모에서 카메라 이동 요청: 센터만 이동(줌 보존)
  useEffect(() => {
    if (!onBindCenter) return;
    onBindCenter((p) => {
      if (!mapRef.current) return;
      if (!followCenter.current) return;
      try {
        mapRef.current.animateCamera(
          didInitCamera.current
            ? { center: p as RNLatLng }
            : { center: p as RNLatLng, zoom: 16 },
          { duration: 650 }
        );
      } catch {}
      didInitCamera.current = true;
    });
  }, [onBindCenter]);

  // 스냅샷 바인딩(요약용)
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
    if (!locationLoading && !useCurrentLocationOnMount) {
      onMapReady?.();
    }
  };

  const init = initial ||
    (last as RNLatLng) || { latitude: 37.5665, longitude: 126.978 };

  const isFiniteNum = (v: any) => typeof v === 'number' && isFinite(v);
  const isValidLatLng = (p: RNLatLng) =>
    p && isFiniteNum((p as any).latitude) && isFiniteNum((p as any).longitude) && Math.abs((p as any).latitude) <= 90 && Math.abs((p as any).longitude) <= 180 && !(((p as any).latitude === 0) && ((p as any).longitude === 0));
  const cleanRoute: RNLatLng[] = Array.isArray(route) ? (route as RNLatLng[]).filter(isValidLatLng) : [];

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={{
        latitude: init.latitude,
        longitude: init.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation={typeof showUserLocation === 'boolean' ? showUserLocation : !!liveMode}
      showsMyLocationButton={typeof showMyLocationButton === 'boolean' ? showMyLocationButton : !!liveMode}
      onMapReady={handleMapReady}
      loadingEnabled
      loadingIndicatorColor="#3B82F6"
      loadingBackgroundColor="#f9fafb"
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      // 🖐️ 사용자 제스처 시 팔로우 해제 → 줌/프레이밍 유지
      onPanDrag={() => stopFollowingTemporarily()}
      onTouchStart={() => stopFollowingTemporarily()}
    >
      {/* 라이브 모드에서는 마커 숨김 (showsUserLocation의 파란 마커만 사용) */}
      {!liveMode && last && (
        <Marker
          coordinate={last as RNLatLng}
          title="위치"
        />
      )}
      {cleanRoute.length > 1 && (
        <Polyline
          coordinates={cleanRoute}
          strokeWidth={5}
          strokeColor="#2563eb"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
