import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Polyline } from "react-native-maps";
import { getRunningRecordDetail } from "@utils/api/running";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

type Props = { route: any; navigation: any };

const RecordDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { recordId } = route.params || {};
  const [recordDetail, setRecordDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const SHEET_EXPANDED_Y = 100;
  const SHEET_COLLAPSED_Y = height * 0.5;
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

  const getRunningTypeColor = (runningType?: string) => {
    switch (runningType) {
      case "SINGLE":
        return "#10b981";
      case "JOURNEY":
        return "#7c3aed";
      case "VIRTUAL":
        return "#3b82f6";
      case "GROUP":
        return "#f59e0b";
      default:
        return "#10b981";
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={s.container}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loadingText}>운동 기록을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recordDetail) {
    return (
      <SafeAreaView edges={["top"]} style={s.container}>
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={s.errorText}>운동 기록을 찾을 수 없습니다</Text>
          <TouchableOpacity
            style={s.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.errorButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const headerImage =
    recordDetail?.photoUrl ||
    recordDetail?.imageUrl ||
    recordDetail?.snapshotUrl;
  const routeCoordsRaw = (recordDetail?.routePoints || []).map((p: any) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    sequence: (p as any)?.sequence,
  }));
  const isFiniteNum = (v: any) => typeof v === "number" && isFinite(v);
  const isValidLatLng = (lat: number, lng: number) =>
    isFiniteNum(lat) &&
    isFiniteNum(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0);
  const routeCoords = routeCoordsRaw
    .filter((p) => isValidLatLng(p.latitude, p.longitude))
    .sort((a, b) => {
      const as = isFiniteNum(a.sequence) ? Number(a.sequence) : 0;
      const bs = isFiniteNum(b.sequence) ? Number(b.sequence) : 0;
      return as - bs;
    })
    .map(({ latitude, longitude }) => ({ latitude, longitude }));

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
    const spk = sec / km;
    const m = Math.floor(spk / 60);
    const s = Math.round(spk % 60);
    return `${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
  };
  const paceLabel: string =
    recordDetail.averagePace || formatPace(durationSec, distanceKm);
  const runningColor = getRunningTypeColor(recordDetail.runningType);

  return (
    <SafeAreaView edges={["top"]} style={s.container}>
      {/* 히어로 이미지/지도 */}
      <Animated.View
        style={[
          s.heroWrap,
          {
            height: translateY.interpolate({
              inputRange: [SHEET_EXPANDED_Y, SHEET_COLLAPSED_Y],
              outputRange: [200, height * 0.5],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        {headerImage ? (
          <Image source={{ uri: headerImage }} style={s.heroImage} />
        ) : routeCoords.length ? (
          <MapView
            style={s.heroImage}
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
              strokeColor={runningColor}
              strokeWidth={5}
            />
          </MapView>
        ) : (
          <LinearGradient
            colors={["#6366F1", "#8B5CF6", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroImage}
          >
            <Ionicons
              name="footsteps"
              size={80}
              color="rgba(255,255,255,0.3)"
            />
          </LinearGradient>
        )}

        {/* 그라데이션 오버레이 */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)"]}
          style={s.heroOverlay}
        />

        {/* 뒤로가기 버튼 */}
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#1F2937" />
        </TouchableOpacity>
      </Animated.View>

      {/* 드로어 시트 */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        <View style={s.sheetInner}>
          {/* 핸들 */}
          <View style={s.handleContainer} {...pan.panHandlers}>
            <View style={s.handle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={s.scrollContent}
            bounces={false}
          >
            {/* 타이틀 섹션 */}
            <View style={s.titleSection}>
              <View style={s.titleRow}>
                <Text style={s.title}>
                  {recordDetail.title ||
                    formatTitleFromDate(recordDetail.startedAt)}
                </Text>
                <View style={[s.typeBadge, { backgroundColor: runningColor }]}>
                  <Text style={s.typeBadgeText}>
                    {getRunningTypeName(recordDetail.runningType)}
                  </Text>
                </View>
              </View>
              <View style={s.subtitleRow}>
                <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                <Text style={s.subtitle}>
                  {formatDate(recordDetail.startedAt)}
                </Text>
              </View>
            </View>

            {/* 메인 통계 카드 */}
            <View style={s.mainStatsCard}>
              <View style={s.statItem}>
                <View style={s.statIconBg}>
                  <Ionicons name="navigate" size={24} color={runningColor} />
                </View>
                <Text style={s.statValue}>{(Math.floor(distanceKm * 100) / 100).toFixed(2)}</Text>
                <Text style={s.statLabel}>거리 (km)</Text>
              </View>

              <View style={s.statDivider} />

              <View style={s.statItem}>
                <View style={s.statIconBg}>
                  <Ionicons name="time" size={24} color={runningColor} />
                </View>
                <Text style={s.statValue}>{formatDuration(durationSec)}</Text>
                <Text style={s.statLabel}>시간</Text>
              </View>

              <View style={s.statDivider} />

              <View style={s.statItem}>
                <View style={s.statIconBg}>
                  <Ionicons name="speedometer" size={24} color={runningColor} />
                </View>
                <Text style={s.statValue}>{paceLabel}</Text>
                <Text style={s.statLabel}>페이스 (/km)</Text>
              </View>
            </View>

            {/* 추가 정보 */}
            <View style={s.additionalSection}>
              <Text style={s.sectionTitle}>상세 정보</Text>

              <View style={s.infoCard}>
                <View style={s.infoRow}>
                  <View style={s.infoLeft}>
                    <Ionicons name="flame" size={20} color="#F59E0B" />
                    <Text style={s.infoLabel}>칼로리</Text>
                  </View>
                  <Text style={s.infoValue}>
                    {recordDetail.calories || 0} kcal
                  </Text>
                </View>

                <View style={s.infoDivider} />

                <View style={s.infoRow}>
                  <View style={s.infoLeft}>
                    <Ionicons name="play-circle" size={20} color="#10B981" />
                    <Text style={s.infoLabel}>시작 시간</Text>
                  </View>
                  <Text style={s.infoValue}>
                    {formatDate(recordDetail.startedAt)}
                  </Text>
                </View>

                {recordDetail.endedAt && (
                  <>
                    <View style={s.infoDivider} />
                    <View style={s.infoRow}>
                      <View style={s.infoLeft}>
                        <Ionicons
                          name="stop-circle"
                          size={20}
                          color="#EF4444"
                        />
                        <Text style={s.infoLabel}>종료 시간</Text>
                      </View>
                      <Text style={s.infoValue}>
                        {formatDate(recordDetail.endedAt)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  heroWrap: {
    width: "100%",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  backBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handleContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
  },
  scrollContent: {
    flex: 1,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  mainStatsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },
  additionalSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#EF4444",
    textAlign: "center",
  },
  errorButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default RecordDetailScreen;
