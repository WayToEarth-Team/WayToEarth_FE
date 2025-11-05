import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Image, PanResponder, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Polyline } from "react-native-maps";
import { getRunningRecordDetail } from "../utils/api/running";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");
// API는 utils/api/running을 통해 호출

type Props = { route: any; navigation: any };

const RecordDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { recordId } = route.params || {};
  const [recordDetail, setRecordDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const SCREEN_H = Dimensions.get("window").height;
  const SHEET_EXPANDED_Y = 120; // 가장 위로 올렸을 때 위치
  const SHEET_COLLAPSED_Y = 420; // 기본 상태 - 지도 바로 아래 (상단 SafeArea 반영여유)
  const translateY = React.useRef(
    new Animated.Value(SHEET_COLLAPSED_Y)
  ).current;
  const startYRef = React.useRef(0);

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translateY.stopAnimation((v: number) => (startYRef.current = v));
      },
      onPanResponderMove: (_evt, { dy }) => {
        let ny = startYRef.current + dy;
        ny = Math.max(SHEET_EXPANDED_Y, Math.min(ny, SHEET_COLLAPSED_Y));
        translateY.setValue(ny);
      },
      onPanResponderRelease: (_evt, { dy, vy }) => {
        const current = startYRef.current + dy;
        const mid = (SHEET_EXPANDED_Y + SHEET_COLLAPSED_Y) / 2;
        const dest =
          vy < -0.35 || current < mid ? SHEET_EXPANDED_Y : SHEET_COLLAPSED_Y;
        Animated.spring(translateY, {
          toValue: dest,
          useNativeDriver: true,
          tension: 120,
          friction: 18,
        }).start();
      },
    })
  ).current;

  const rawId =
    route?.params?.recordId ?? route?.params?.id ?? route?.params?.runId;
  const recordIdNum =
    typeof rawId === "number"
      ? rawId
      : Number.isFinite(Number(rawId))
      ? Number(rawId)
      : NaN;

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(recordIdNum)) {
        setLoading(false);
        return;
      }
      fetchRecordDetail(recordIdNum);
    }, [recordIdNum])
  );

  const fetchRecordDetail = async (id: number) => {
    try {
      const detail = await getRunningRecordDetail(id);
      setRecordDetail(detail);
    } catch (error) {
      console.error("Record Detail fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return "00:00:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const y = d.getFullYear().toString();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "오후" : "오전";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const hh = displayHours.toString().padStart(2, "0");
    return `${m}월 ${day}일 ${ampm} ${hh}:${minutes}`;
  };

  const formatTitleFromDate = (dateStr?: string) => {
    if (!dateStr) return "러닝";
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}/${m}/${day} 러닝`;
  };

  const getRunningTypeName = (runningType?: string) => {
    switch (runningType) {
      case "SINGLE":
        return "싱글런";
      case "JOURNEY":
        return "여정런";
      case "VIRTUAL":
        return "버추얼런";
      case "GROUP":
        return "그룹런";
      default:
        return "싱글런";
    }
  };

  const getRunningTypeBadgeStyle = (runningType?: string) => {
    switch (runningType) {
      case "SINGLE":
        return { backgroundColor: "#10b981" };
      case "JOURNEY":
        return { backgroundColor: "#7c3aed" };
      case "VIRTUAL":
        return { backgroundColor: "#3b82f6" };
      case "GROUP":
        return { backgroundColor: "#f59e0b" };
      default:
        return { backgroundColor: "#10b981" };
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>운동 기록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recordDetail) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>운동 기록을 찾을 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const headerImage =
    recordDetail?.photoUrl ||
    recordDetail?.imageUrl ||
    recordDetail?.snapshotUrl;
  const routeCoords = (recordDetail?.routePoints || []).map((p: any) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // 안전한 표시용 값 계산
  const distanceKm: number =
    typeof recordDetail.totalDistanceKm === "number"
      ? recordDetail.totalDistanceKm
      : typeof (recordDetail as any).distanceKm === "number"
      ? (recordDetail as any).distanceKm
      : 0;
  const durationSec: number =
    typeof recordDetail.totalDurationSec === "number"
      ? recordDetail.totalDurationSec
      : typeof (recordDetail as any).durationSeconds === "number"
      ? (recordDetail as any).durationSeconds
      : 0;
  const formatPace = (sec: number, km: number) => {
    if (!km || !sec) return "-";
    const spk = sec / km; // sec per km
    const m = Math.floor(spk / 60);
    const s = Math.round(spk % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const paceLabel: string =
    recordDetail.averagePace || formatPace(durationSec, distanceKm);

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* 배경: 큰 이미지 또는 지도 - 동적 크기 */}
      <Animated.View style={[
        styles.heroWrap,
        {
          transform: [{
            translateY: translateY.interpolate({
              inputRange: [SHEET_EXPANDED_Y, SHEET_COLLAPSED_Y],
              outputRange: [0, 0],
              extrapolate: 'clamp',
            })
          }],
          height: translateY.interpolate({
            inputRange: [SHEET_EXPANDED_Y, SHEET_COLLAPSED_Y],
            outputRange: [320, 600],
            extrapolate: 'clamp',
          })
        }
      ]}>
        {headerImage ? (
          <Image source={{ uri: headerImage }} style={styles.heroImage} />
        ) : routeCoords.length ? (
          <MapView
            style={styles.heroImage}
            pointerEvents="none"
            initialRegion={{
              latitude: routeCoords[0].latitude,
              longitude: routeCoords[0].longitude,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }}
          >
            <Polyline
              coordinates={routeCoords}
              strokeColor={recordDetail?.runningType === 'JOURNEY' ? '#7c3aed' : '#10b981'}
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={[styles.heroImage, {
            backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            alignItems: "center",
            justifyContent: "center",
          }]}>
            <Text style={{ fontSize: 48, color: "rgba(255,255,255,0.8)" }}>🏃‍♂️</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 드로어: 내용을 위에서 당겨 펼치는 시트 */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.sheetInner}>
          <View style={styles.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            <View style={styles.titleSection} {...pan.panHandlers}>
              <Text style={styles.title}>
                {recordDetail.title ||
                  formatTitleFromDate(recordDetail.startedAt)}
              </Text>
              <View
                style={[
                  styles.typeBadge,
                  getRunningTypeBadgeStyle(recordDetail.runningType),
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {getRunningTypeName(recordDetail.runningType)}
                </Text>
              </View>
              <Text style={styles.date}>
                총 시간 {formatDuration(durationSec)} · {distanceKm.toFixed(2)} km
              </Text>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>
                  {distanceKm.toFixed(2)}
                </Text>
                <Text style={styles.mainStatUnit}>km</Text>
                <Text style={styles.mainStatLabel}>거리</Text>
              </View>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>
                  {formatDuration(durationSec)}
                </Text>
                <Text style={styles.mainStatUnit}>시간</Text>
                <Text style={styles.mainStatLabel}>운동 시간</Text>
              </View>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatValue}>{paceLabel || "-"}</Text>
                <Text style={styles.mainStatUnit}>/km</Text>
                <Text style={styles.mainStatLabel}>평균 페이스</Text>
              </View>
            </View>

            {/* 추가 정보 섹션 */}
            <View style={styles.additionalInfo}>
              <Text style={styles.sectionTitle}>운동 상세</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>칼로리</Text>
                <Text style={styles.infoValue}>{recordDetail.calories || 0} kcal</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>시작 시간</Text>
                <Text style={styles.infoValue}>{formatDate(recordDetail.startedAt)}</Text>
              </View>
              {recordDetail.endedAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>종료 시간</Text>
                  <Text style={styles.infoValue}>{formatDate(recordDetail.endedAt)}</Text>
                </View>
              )}
            </View>

            {/* 확장 섹션 자리 */}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  heroWrap: {
    width: "100%",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backIcon: { fontSize: 20, fontWeight: "700", color: "#1e293b" },
  content: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "transparent",
    paddingTop: 0,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
    marginTop: 12,
    marginBottom: 8,
  },
  titleSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
  typeBadge: {
    alignSelf: "flex-start",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  typeBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "rgba(99, 102, 241, 0.04)",
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  mainStat: { alignItems: "center", flex: 1 },
  mainStatValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.4,
  },
  mainStatUnit: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  mainStatLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f8fafc",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  scrollContent: {
    flex: 1,
  },
  additionalInfo: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: -0.1,
  },
});

export default RecordDetailScreen;
