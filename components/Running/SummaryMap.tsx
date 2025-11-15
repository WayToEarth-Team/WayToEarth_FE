import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, Alert } from "react-native";
import MapView, { Marker, Polyline, LatLng, Region } from "react-native-maps";
import * as Location from "expo-location";

/** 거리 계산 (m) */
const toRad = (d: number) => (d * Math.PI) / 180;
const haversine = (a: LatLng, b: LatLng) => {
  const R = 6371e3;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(A));
};

/** 1km 지점 마커 근사 */
function computeKmMarkers(route: LatLng[]): LatLng[] {
  if (!route || route.length < 2) return [];
  const markers: LatLng[] = [];
  let acc = 0;
  let nextKm = 1000;
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const cur = route[i];
    const seg = haversine(prev, cur);
    while (acc + seg >= nextKm) {
      const remain = nextKm - acc;
      const t = remain / seg; // 선형 보간
      markers.push({
        latitude: prev.latitude + (cur.latitude - prev.latitude) * t,
        longitude: prev.longitude + (cur.longitude - prev.longitude) * t,
      });
      nextKm += 1000;
    }
    acc += seg;
  }
  return markers;
}

type Props = {
  route: LatLng[];
  height?: number;
  borderRadius?: number;
  showKmMarkers?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  edgePadding?: { top: number; bottom: number; left: number; right: number };
  useCurrentLocationOnMount?: boolean; // 기본값: false (불필요한 GPS 활성화 방지)
  showUserLocation?: boolean; // 기본값: false
};

export default function SummaryMap({
  route,
  height = 220,
  borderRadius = 14,
  showKmMarkers = true,
  strokeColor = "#2563eb",
  strokeWidth = 6,
  edgePadding = { top: 60, bottom: 60, left: 60, right: 60 },
  useCurrentLocationOnMount = false,
  showUserLocation = false,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

  const isFiniteNum = (v: any) => typeof v === 'number' && isFinite(v);
  const isValidLatLng = (p: LatLng) =>
    p && isFiniteNum(p.latitude) && isFiniteNum(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);
  const cleanRoute: LatLng[] = Array.isArray(route) ? route.filter(isValidLatLng) : [];
  const start = cleanRoute?.[0];
  const end = cleanRoute?.[cleanRoute.length - 1];
  const kmMarkers = useMemo(
    () => (showKmMarkers ? computeKmMarkers(cleanRoute || []) : []),
    [cleanRoute, showKmMarkers]
  );

  // 현재 위치는 선택적으로만 요청 (기본 비활성화)
  useEffect(() => {
    if (!useCurrentLocationOnMount) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        // 캐시 우선 사용 → 불필요한 GPS 활성화 최소화
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        const loc = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        setCurrentRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (e) {
        // 조용히 무시
      }
    })();
  }, [useCurrentLocationOnMount]);

  // 최초 프레이밍 (route가 있으면 route 기준, 없으면 현 위치 기준)
  useEffect(() => {
    if (!ready) return;
    if (cleanRoute && cleanRoute.length > 0) {
      setTimeout(() => {
        if (cleanRoute.length === 1) {
          const r: Region = {
            latitude: cleanRoute[0].latitude,
            longitude: cleanRoute[0].longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          };
          mapRef.current?.animateToRegion(r, 600);
        } else {
          mapRef.current?.fitToCoordinates(cleanRoute, {
            edgePadding,
            animated: true,
          });
        }
      }, 100);
    } else if (currentRegion) {
      mapRef.current?.animateToRegion(currentRegion, 600);
    }
  }, [ready, route, currentRegion, edgePadding]);

  return (
    <View style={[styles.wrap, { height, borderRadius }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        onMapReady={() => setReady(true)}
        initialRegion={
          currentRegion || {
            latitude: 37.5665,
            longitude: 126.978,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }
        }
        showsUserLocation={showUserLocation}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
      >
        {start && <Marker coordinate={start} title="Start" pinColor="green" />}
        {cleanRoute?.length > 1 && (
          <Polyline
            coordinates={cleanRoute}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
          />
        )}
        {end && <Marker coordinate={end} title="Finish" pinColor="red" />}
        {kmMarkers.map((p, i) => (
          <Marker key={`km-${i}`} coordinate={p}>
            <View style={styles.kmBadge}>
              <Text style={styles.kmText}>{i + 1} km</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: "#F3F4F6" },
  kmBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  kmText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
