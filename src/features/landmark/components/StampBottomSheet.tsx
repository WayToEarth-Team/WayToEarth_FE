// src/features/landmark/components/StampBottomSheet.tsx
// 스탬프 수집 바텀시트 - HTML 디자인 완전 동일하게 구현

import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { LatLng } from "@types/types";
import type { JourneyId } from "@types/journey";
import {
  checkCollection,
  collectStampForProgress,
  getProgressStamps,
  getOrFetchProgressId,
  type StampResponse,
} from "@utils/api/stamps";
import { getLandmarkDetail } from "@utils/api/landmarks";
import { distanceKm } from "@utils/geo";
import { useNavigation } from "@react-navigation/native";
import {
  addStampCollectedListener,
  type StampCollectedPayload,
} from "@utils/navEvents";

type LandmarkLite = { id: number; name: string; distanceM?: number };

type Props = {
  userId: number;
  journeyId: JourneyId;
  progressPercent: number;
  landmarks: LandmarkLite[];
  currentLocation: LatLng | null;
  currentProgressM: number; // 현재 진행한 거리(미터)
  onCollected?: (stamp: StampResponse) => void;
  extraCollectedIds?: number[];
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLLAPSED_PEEK = 90; // 접혔을 때 더 많이 보임: 90px (사이드 패널처럼)
const MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, SCREEN_HEIGHT - 80);

export default function StampBottomSheet({
  userId,
  journeyId,
  progressPercent,
  landmarks,
  currentLocation,
  currentProgressM,
  onCollected,
  extraCollectedIds,
}: Props) {
  const navigation = useNavigation<any>();
  const translateY = useRef(
    new Animated.Value(MAX_HEIGHT - COLLAPSED_PEEK)
  ).current;
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [stamps, setStamps] = useState<StampResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [landmarkDetails, setLandmarkDetails] = useState<Map<number, any>>(
    new Map()
  );
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successStamp, setSuccessStamp] = useState<StampResponse | null>(null);
  const lastTap = useRef<number | null>(null);

  // 모달 애니메이션
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalBounce = useRef(new Animated.Value(0)).current;

  // 진행 ID 및 스탬프 목록 로드
  useEffect(() => {
    (async () => {
      const pid = await getOrFetchProgressId(userId, journeyId);
      setProgressId(pid);
      if (pid) {
        try {
          setLoading(true);
          const list = await getProgressStamps(pid);
          setStamps(list);
        } catch (e: any) {
          setError(e?.message || "스탬프 목록을 불러오지 못했습니다");
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [userId, journeyId]);

  // 외부에서 스탬프가 수집되면(예: 자동 수집) 즉시 반영
  useEffect(() => {
    const sub = addStampCollectedListener((p: StampCollectedPayload) => {
      try {
        const s = p?.stamp as any;
        const lmId = Number(p?.landmarkId || s?.landmark?.id || NaN);
        if (!lmId || Number.isNaN(lmId)) return;
        setStamps((prev) => {
          const exists = prev.some((it) => Number(it?.landmark?.id) === lmId);
          return exists ? prev : [s as StampResponse, ...prev];
        });
      } catch {}
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);

  // 각 랜드마크의 상세 정보 로드 (이미지, 위치 등) - 최초 1회만
  const loadedIdsRef = useRef(new Set<number>());

  useEffect(() => {
    landmarks.forEach(async (lm) => {
      // 이미 로드 중이거나 로드된 랜드마크는 스킵
      if (loadedIdsRef.current.has(lm.id)) return;
      loadedIdsRef.current.add(lm.id);

      try {
        const detail = await getLandmarkDetail(lm.id, userId);
        setLandmarkDetails((prev) => new Map(prev).set(lm.id, detail));
      } catch (e) {
        console.warn(`[StampBottomSheet] 랜드마크 ${lm.id} 상세 로드 실패:`, e);
        // 실패하면 다시 시도할 수 있도록 제거
        loadedIdsRef.current.delete(lm.id);
      }
    });
  }, [landmarks.map((l) => l.id).join(","), userId]);

  const collectedIds = useMemo(() => {
    const internalIds = stamps
      .map((s) => s.landmark?.id)
      .filter(Boolean) as number[];
    const extra = Array.isArray(extraCollectedIds) ? extraCollectedIds : [];
    return new Set<number>([...internalIds, ...extra]);
  }, [stamps, extraCollectedIds]);

  // 현재 위치에서 각 랜드마크까지의 거리 계산
  const landmarksWithDistance = useMemo(() => {
    return landmarks.map((lm) => {
      const detail = landmarkDetails.get(lm.id);
      let distanceToLandmark = null;
      let distanceRemaining = null;

      // 현재 GPS 위치에서 랜드마크까지의 직선 거리
      if (currentLocation && detail?.latitude && detail?.longitude) {
        const d = distanceKm(currentLocation, {
          latitude: detail.latitude,
          longitude: detail.longitude,
        });
        distanceToLandmark = d * 1000; // 미터
      }

      // 여정 진행 기준 남은 거리
      if (lm.distanceM && currentProgressM < lm.distanceM) {
        distanceRemaining = lm.distanceM - currentProgressM;
      }

      return {
        ...lm,
        detail,
        distanceToLandmark,
        distanceRemaining,
      };
    });
  }, [landmarks, landmarkDetails, currentLocation, currentProgressM]);

  const nextCollectable = useMemo(() => {
    return landmarksWithDistance.find((lm) => !collectedIds.has(lm.id));
  }, [landmarksWithDistance, collectedIds]);

  const onToggle = useCallback(
    (toExpand: boolean) => {
      setExpanded(toExpand);
      Animated.spring(translateY, {
        toValue: toExpand ? 0 : MAX_HEIGHT - COLLAPSED_PEEK,
        useNativeDriver: true,
        stiffness: 200,
        damping: 25,
        mass: 0.8,
      }).start();
    },
    [translateY]
  );

  // 더블 탭 핸들러
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      // 더블 탭 감지
      onToggle(!expanded);
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  }, [expanded, onToggle]);

  const startY = useRef(0);
  const isDoubleTap = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => false,
      onPanResponderGrant: (_, g) => {
        // 애니메이션 즉시 중단
        translateY.stopAnimation((value) => {
          startY.current = value;
        });
        isDoubleTap.current = false;

        // 더블 탭 감지
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
          // 더블 탭!
          isDoubleTap.current = true;
          onToggle(!expanded);
          lastTap.current = null;
        } else {
          lastTap.current = now;
        }
      },
      onPanResponderMove: (_, g) => {
        // 더블 탭이면 움직임 무시
        if (isDoubleTap.current) return;

        // 손가락 움직임을 정확히 따라가도록 (부드럽게)
        const next = Math.min(
          MAX_HEIGHT - COLLAPSED_PEEK,
          Math.max(0, startY.current + g.dy)
        );
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        // 더블 탭이면 release 무시
        if (isDoubleTap.current) {
          return;
        }

        // 스와이프가 거의 없었다면 (단일 탭) 현재 상태 유지
        if (Math.abs(g.dy) < 30 && Math.abs(g.vy) < 0.3) {
          // 현재 expanded 상태에 맞춰 원래 위치로
          const targetY = expanded ? 0 : MAX_HEIGHT - COLLAPSED_PEEK;
          Animated.spring(translateY, {
            toValue: targetY,
            useNativeDriver: true,
            stiffness: 300,
            damping: 30,
          }).start();
          return;
        }

        const threshold = (MAX_HEIGHT - COLLAPSED_PEEK) / 2;
        const current = (translateY as any)._value as number;
        const shouldExpand = g.vy < 0 || current < threshold;
        onToggle(shouldExpand);
      },
    })
  ).current;

  const showSuccessModal = useCallback(
    (stamp: StampResponse) => {
      setSuccessStamp(stamp);
      setSuccessModalVisible(true);

      // 모달 애니메이션
      modalScale.setValue(0);
      modalBounce.setValue(0);

      Animated.sequence([
        Animated.spring(modalScale, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 200,
          damping: 15,
        }),
        Animated.sequence([
          Animated.timing(modalBounce, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(modalBounce, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [modalScale, modalBounce]
  );

  const handleCollect = useCallback(async () => {
    if (!progressId || !nextCollectable) return;
    if (!currentLocation) {
      setError("현재 위치를 확인할 수 없습니다");
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const ok = await checkCollection(progressId, nextCollectable.id);
      if (!ok) {
        setError("스탬프 수집 조건이 충족되지 않았습니다 (거리/진행률 확인)");
        return;
      }
      const granted = await collectStampForProgress(
        progressId,
        nextCollectable.id,
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }
      );
      setStamps((prev) => [granted, ...prev]);
      onCollected?.(granted);

      // 성공 모달 표시
      showSuccessModal(granted);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "스탬프 수집 실패");
    } finally {
      setLoading(false);
    }
  }, [
    progressId,
    nextCollectable,
    currentLocation,
    onCollected,
    showSuccessModal,
  ]);

  const closeSuccessModal = useCallback(() => {
    setSuccessModalVisible(false);
    setSuccessStamp(null);
  }, []);

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            height: MAX_HEIGHT,
            transform: [{ translateY }],
            backgroundColor: "#fff", // 항상 흰색 배경
            zIndex: 1000, // 다른 요소들보다 위에 표시
          },
        ]}
      >
        {/* 드래그 핸들 + 헤더 전체 - 더블 탭 & 스와이프 가능 */}
        <View {...panResponder.panHandlers} style={styles.interactiveArea}>
          {/* 드래그 핸들 */}
          <View style={styles.dragHandleArea}>
            <View style={styles.dragHandle} />
          </View>

          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>랜드마크 스탬프</Text>
            <View style={styles.subtitleRow}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                }}
              >
                <Ionicons name="flag-outline" size={16} color="#666" />
                <Text style={styles.subtitle}>
                  각 위치에 도착해서 스탬프를 수집하세요
                </Text>
              </View>
              <LinearGradient
                colors={["#667eea", "#764ba2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Ionicons name="star-outline" size={14} color="#fff" />
                <Text style={styles.badgeText}>
                  {Math.max(0, Math.min(100, progressPercent)).toFixed(0)}%
                </Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* 에러 메시지 */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 스탬프 그리드 */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View style={styles.grid}>
            {landmarksWithDistance.map((lm) => {
              const collected = collectedIds.has(lm.id);
              const detail = lm.detail;
              const imageUrl = detail?.imageUrl || "";

              // 거리 표시 텍스트
              let distanceText = null;
              if (!collected && lm.distanceRemaining != null) {
                const km = lm.distanceRemaining / 1000;
                distanceText =
                  km >= 1
                    ? `${km.toFixed(1)}km 남음`
                    : `${Math.round(lm.distanceRemaining)}m 남음`;
              }

              return (
                <TouchableOpacity
                  key={lm.id}
                  activeOpacity={0.85}
                  style={[
                    styles.stampCard,
                    collected && styles.stampCardCollected,
                  ]}
                  onPress={() => {
                    if (!collected) return;
                    try {
                      navigation?.navigate?.("LandmarkGuestbookScreen", {
                        landmarkId: lm.id,
                      });
                    } catch {}
                  }}
                >
                  <View style={styles.stampImageWrapper}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.stampImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.stampPlaceholder}>
                        <Ionicons
                          name="business-outline"
                          size={40}
                          color="#9CA3AF"
                        />
                      </View>
                    )}

                    {/* 미수집: 반투명 오버레이 (이미지는 보이되 흐리게) */}
                    {!collected && (
                      <View style={styles.stampLockedOverlay}>
                        <Ionicons
                          name="lock-closed-outline"
                          size={32}
                          color="#fff"
                        />
                      </View>
                    )}

                    {/* 수집됨: 체크마크 */}
                    {collected && (
                      <LinearGradient
                        colors={["#667eea", "#764ba2"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.stampCheckmark}
                      >
                        <Ionicons
                          name="checkmark-outline"
                          size={18}
                          color="#fff"
                        />
                      </LinearGradient>
                    )}

                    {/* 거리 배지 */}
                    {distanceText && (
                      <View style={styles.stampDistanceBadge}>
                        <Text style={styles.distanceBadgeText}>
                          {distanceText}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.stampInfo}>
                    <Text style={styles.stampName} numberOfLines={1}>
                      {lm.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#999"
                      />
                      <Text style={styles.stampLocation}>
                        {detail?.cityName || "위치"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* 수집 버튼 */}
        <View style={styles.collectArea}>
          <TouchableOpacity
            onPress={handleCollect}
            disabled={!nextCollectable || loading}
            style={[
              styles.collectBtn,
              (!nextCollectable || loading) && styles.collectBtnDisabled,
            ]}
          >
            <LinearGradient
              colors={
                nextCollectable && !loading
                  ? ["#667eea", "#764ba2"]
                  : ["#E0E0E0", "#E0E0E0"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.collectBtnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="location-outline" size={20} color="#fff" />
                  <Text
                    style={[
                      styles.collectBtnText,
                      !nextCollectable && { color: "#999" },
                    ]}
                  >
                    {nextCollectable
                      ? `현재 위치에서 스탬프 수집`
                      : `모든 스탬프 수집 완료`}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* 스탬프 획득 성공 모달 */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ scale: modalScale }, { translateY: modalBounce }],
              },
            ]}
          >
            <View style={{ marginBottom: 20 }}>
              <Ionicons name="trophy-outline" size={80} color="#111827" />
            </View>
            <Text style={styles.modalTitle}>스탬프 획득!</Text>
            <View style={styles.modalStampPreview}>
              <Ionicons name="business-outline" size={64} color="#6B7280" />
            </View>
            <Text style={styles.modalText}>
              <Text style={styles.modalBold}>
                {successStamp?.landmark?.name}
              </Text>{" "}
              스탬프를 성공적으로 수집했습니다!{"\n"}계속해서 여정을
              이어가보세요.
            </Text>
            <TouchableOpacity
              onPress={closeSuccessModal}
              style={styles.modalBtn}
            >
              <LinearGradient
                colors={["#667eea", "#764ba2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalBtnGradient}
              >
                <Text style={styles.modalBtnText}>확인</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
    zIndex: 1000,
  },
  interactiveArea: {
    // 터치 가능한 넓은 영역
  },
  dragHandleArea: {
    padding: 8,
    paddingBottom: 4,
    paddingTop: 6,
  },
  dragHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#6366F1", // 보라색으로 변경
    alignSelf: "center",
    opacity: 0.6,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  errorBox: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  stampCard: {
    width: "30%",
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 3,
    borderColor: "transparent",
  },
  stampCardCollected: {
    borderColor: "#667eea",
  },
  stampImageWrapper: {
    position: "relative",
    aspectRatio: 1,
    overflow: "hidden",
  },
  stampImage: {
    width: "100%",
    height: "100%",
  },
  stampPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  stampEmoji: {
    fontSize: 40,
  },
  stampLockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 32,
  },
  stampCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#667eea",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  checkmarkText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  stampDistanceBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#667eea",
  },
  stampInfo: {
    padding: 12,
    backgroundColor: "#fff",
  },
  stampName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  stampLocation: {
    fontSize: 11,
    color: "#999",
  },
  collectArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "#fff",
    borderTopColor: "#f0f0f0",
    borderTopWidth: 1,
  },
  collectBtn: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#667eea",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  collectBtnDisabled: {
    shadowOpacity: 0,
  },
  collectBtnGradient: {
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  collectBtnIcon: {
    fontSize: 20,
  },
  collectBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  // 성공 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 40,
    paddingHorizontal: 32,
    width: 340,
    alignItems: "center",
  },
  modalIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  modalStampPreview: {
    marginVertical: 20,
    padding: 20,
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
  },
  modalStampEmoji: {
    fontSize: 64,
  },
  modalText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 28,
    lineHeight: 22,
    textAlign: "center",
  },
  modalBold: {
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalBtn: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  modalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
