// Pages/JourneyRunningScreen.tsx
// 여정 러닝 메인 화면 (실시간 추적 + 진행률)

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import * as Location from "expo-location";
import SafeLayout from "../components/Layout/SafeLayout";
import {
  View,
  Text,
  Alert,
  Pressable,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  AppState,
  Image as RNImage,
} from "react-native";
import JourneyMapRoute from "../components/Journey/JourneyMapRoute";
import JourneyProgressCard from "../components/Journey/JourneyProgressCard";
import RunStatsCard from "../components/Running/RunStatsCard";
import RunStatsSidePanel from "../components/Running/RunStatsSidePanel";
import RunPlayControls from "../components/Running/RunPlayControls";
import CountdownOverlay from "../components/Running/CountdownOverlay";
import WeatherWidget from "../components/Running/WeatherWidget";
import GuestbookCreateModal from "../components/Guestbook/GuestbookCreateModal";
import LandmarkStatistics from "../components/Guestbook/LandmarkStatistics";
import ImageCarousel from "../components/Common/ImageCarousel";
import StampBottomSheet from "../components/Landmark/StampBottomSheet";
import { LinearGradient } from "expo-linear-gradient";
import { useJourneyRunning } from "../hooks/journey/useJourneyRunning";
import { useBackgroundRunning } from "../hooks/journey/useBackgroundRunning";
import { useWeather } from "../contexts/WeatherContext";
import { useAuth } from "../contexts/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LatLng } from "../types/types";
import type { JourneyId } from "../types/journey";
import { apiComplete, checkPaceCoach } from "../utils/api/running";
import { updateUserSettings } from "../utils/api/users";
import EmblemCelebration from "../components/Effects/EmblemCelebration";
import { awardEmblemByCode } from "../utils/api/emblems";
import type { LandmarkSummary } from "../types/guestbook";
import type { LandmarkDetail } from "../types/landmark";
import { getLandmarkDetail } from "../utils/api/landmarks";
import { distanceKm } from "../utils/geo";
import { Ionicons } from "@expo/vector-icons";
import { ConfirmAlert, MessageAlert } from "../components/ui/AlertDialog";
import {
  getOrFetchProgressId,
  getProgressStamps,
  checkCollection,
  collectStampForProgress,
  type StampResponse,
} from "../utils/api/stamps";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emitRunningSession } from "../utils/navEvents";
import {
  initWatchSync,
  startRunOrchestrated,
  isWatchAvailable,
  subscribeRealtimeUpdates,
  type RealtimeRunningData,
} from "../src/modules/watchSync";
import { useWatchConnection } from "../src/hooks/useWatchConnection";
import { useWatchRunning } from "../src/hooks/useWatchRunning";

type RouteParams = {
  route: {
    params?: {
      journeyId?: JourneyId;
      journeyTitle?: string;
      totalDistanceKm?: number;
      landmarks?: Array<{
        id: string;
        name: string;
        position: LatLng;
        distance: string;
        distanceM: number;
      }>;
      journeyRoute?: LatLng[];
    };
  };
  navigation?: any;
};

export default function JourneyRunningScreen(
  props: RouteParams = { route: { params: {} } }
) {
  const route = props?.route as any;
  const navigation = props?.navigation as any;
  const params = route?.params || {};
  const journeyId = params.journeyId; // 반드시 전달되어야 함
  const journeyTitle = params.journeyTitle || "여정 러닝";
  const totalDistanceKm = params.totalDistanceKm || 42.5;
  const landmarks = params.landmarks || [];
  const journeyRoute = params.journeyRoute || [];

  // 로그인된 사용자 ID
  const { userId, user, refreshProfile } = useAuth();

  // 워치 연결 상태
  const watchStatus = useWatchConnection();

  // 워치 모드 상태
  const [watchMode, setWatchMode] = useState(false);
  const [watchRunning, setWatchRunning] = useState(false);
  const [watchData, setWatchData] = useState<RealtimeRunningData | null>(null);
  const [watchCompleteData, setWatchCompleteData] = useState<any>(null);
  const [alert, setAlert] = useState<{
    open: boolean;
    title?: string;
    message?: string;
  }>({ open: false });

  // 화면 포커스 시 프로필 재조회하여 만료된 아바타 URL 갱신
  useFocusEffect(
    React.useCallback(() => {
      try {
        refreshProfile();
      } catch {}
    }, [refreshProfile])
  );
  const lastAvatarUrlRef = React.useRef<string | undefined>(undefined);
  const [cachedAvatarUrl, setCachedAvatarUrl] = React.useState<
    string | undefined
  >(undefined);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [avatarBust, setAvatarBust] = useState<number>(0);
  // 초기 마운트 시 이전에 저장된 아바타 URL 로드
  React.useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem("@me_avatar_url");
        if (v && /^https?:\/\//i.test(v)) setCachedAvatarUrl(v);
      } catch {}
    })();
  }, []);
  const currentAvatarUrl = React.useMemo(() => {
    const raw =
      (user as any)?.profile_image_url ||
      (user as any)?.profileImageUrl ||
      undefined;
    const key =
      (user as any)?.profile_image_key ||
      (user as any)?.updated_at ||
      (user as any)?.updatedAt ||
      undefined;
    const withVersion = raw
      ? raw.includes("?")
        ? raw
        : `${raw}?v=${encodeURIComponent(String(key || "1"))}`
      : undefined;
    if (withVersion && /^https?:\/\//i.test(withVersion)) {
      lastAvatarUrlRef.current = withVersion; // 유효한 URL만 캐시
      // AsyncStorage에도 저장하여 화면 재진입시 사용
      try {
        AsyncStorage.setItem("@me_avatar_url", withVersion).catch(() => {});
      } catch {}
      return withVersion;
    }
    // 일시적으로 user가 null이 되거나 빈 값이면 마지막 정상 URL 유지
    return lastAvatarUrlRef.current || cachedAvatarUrl;
  }, [user, cachedAvatarUrl]);

  // 화면 포커스마다 지도(컴포넌트) 리마운트하여 Marker/이미지 상태 초기화
  useFocusEffect(
    React.useCallback(() => {
      setMapKey((k) => k + 1);
      setAvatarBust(Date.now());
      // 포커스 시 프로필 재조회 및 이미지 프리페치
      try {
        refreshProfile();
      } catch {}
      const u = lastAvatarUrlRef.current || cachedAvatarUrl;
      if (u) {
        try {
          const sep = u.includes('?') ? '&' : '?';
          RNImage.prefetch(`${u}${sep}t=${Date.now()}`).catch(() => {});
        } catch {}
      }
    }, [cachedAvatarUrl, refreshProfile])
  );

  const focusAvatarUrl = React.useMemo(() => {
    const u = lastAvatarUrlRef.current || cachedAvatarUrl || currentAvatarUrl;
    if (!u) return undefined;
    const sep = u.includes('?') ? '&' : '?';
    return `${u}${sep}t=${avatarBust}`;
  }, [currentAvatarUrl, cachedAvatarUrl, avatarBust]);

  // 랜드마크 도달 시 스탬프 수집 및 방명록 작성 모달 표시
  const handleLandmarkReached = useCallback(
    async (landmark: any) => {
      if (userId == null) return;
      console.log("[JourneyRunning] 랜드마크 도달:", landmark.name);

      // 스탬프 수집 (자동, 서버 규칙 준수: progressId/좌표 필요)
      try {
        const pid =
          progressId || (await getOrFetchProgressId(userId, journeyId));
        const lastPoint = (
          t.route?.length ? t.route[t.route.length - 1] : null
        ) as LatLng | null;
        const lmid = parseInt(landmark.id);
        if (pid && lastPoint && !collectedSet.has(lmid)) {
          const can = await checkCollection(pid, lmid);
          if (can) {
            await collectStampForProgress(pid, lmid, {
              latitude: lastPoint.latitude,
              longitude: lastPoint.longitude,
            });
            setCollectedSet((prev) => new Set(prev).add(lmid));
            console.log("[JourneyRunning] ✅ 스탬프 수집 완료:", landmark.name);
          } else {
            console.log("[JourneyRunning] ℹ️ 조건 미충족으로 자동 수집 생략");
          }
        }
      } catch (error) {
        console.error("[JourneyRunning] ❌ 스탬프 수집 실패:", error);
        // 수집 실패해도 계속 진행 (방명록은 작성 가능)
      }

      // 랜드마크를 LandmarkSummary 형식으로 변환
      const landmarkSummary: LandmarkSummary = {
        id: parseInt(landmark.id),
        name: landmark.name,
        cityName: "서울", // TODO: 실제 도시명으로 교체
        countryCode: "KR",
        imageUrl: "", // TODO: 실제 이미지 URL로 교체
      };

      setSelectedLandmark(landmarkSummary);
      setGuestbookModalVisible(true);

      // 축하 알림 표시
      Alert.alert(
        `🎉 ${landmark.name} 도착!`,
        "스탬프를 획득했습니다! 랜드마크에 방명록을 남겨보세요.",
        [
          {
            text: "나중에",
            style: "cancel",
            onPress: () => {
              setGuestbookModalVisible(false);
              setSelectedLandmark(null);
            },
          },
          { text: "방명록 작성", onPress: () => {} },
        ]
      );
    },
    [userId, journeyId, progressId, collectedSet]
  );

  const t = useJourneyRunning({
    journeyId,
    userId: userId != null ? String(userId) : "", // number를 string으로 변환
    totalDistanceM: totalDistanceKm * 1000,
    landmarks,
    journeyRoute,
    onLandmarkReached: handleLandmarkReached,
  });

  // 백그라운드 러닝 훅
  const backgroundRunning = useBackgroundRunning();

  const insets = useSafeAreaInsets();
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [guestbookModalVisible, setGuestbookModalVisible] = useState(false);
  const [selectedLandmark, setSelectedLandmark] =
    useState<LandmarkSummary | null>(null);
  const [landmarkMenuVisible, setLandmarkMenuVisible] = useState(false);
  const [menuLandmark, setMenuLandmark] = useState<any>(null);
  const [landmarkDetail, setLandmarkDetail] = useState<LandmarkDetail | null>(
    null
  );
  const [progressId, setProgressId] = useState<string | null>(null);
  const [collectedSet, setCollectedSet] = useState<Set<number>>(new Set());
  const collectingRef = useRef<Set<number>>(new Set());
  const [celebrate, setCelebrate] = useState<{
    visible: boolean;
    count?: number;
  }>({ visible: false });
  const celebratedKmRef = React.useRef<Set<number>>(new Set());
  const celebratingRef = React.useRef(false);

  // 페이스 코치 관련 상태
  const [isPaceCoachEnabled, setIsPaceCoachEnabled] = useState(
    user?.is_pace_coach_enabled ?? false
  );
  const [lastCheckedBucket, setLastCheckedBucket] = useState(0);
  const [paceAlertVisible, setPaceAlertVisible] = useState(false);
  const [paceAlertMessage, setPaceAlertMessage] = useState("");

  // 사용자 프로필 변경 시 isPaceCoachEnabled 동기화
  useEffect(() => {
    if (user?.is_pace_coach_enabled !== undefined) {
      setIsPaceCoachEnabled(user.is_pace_coach_enabled);
    }
  }, [user?.is_pace_coach_enabled]);

  // 페이스 코치 토글 핸들러
  const handlePaceCoachToggle = useCallback(async () => {
    const newValue = !isPaceCoachEnabled;
    setIsPaceCoachEnabled(newValue);
    try {
      await updateUserSettings({ is_pace_coach_enabled: newValue });
      await refreshProfile();
    } catch (error) {
      console.error('[PaceCoach] 설정 업데이트 실패:', error);
      setIsPaceCoachEnabled(!newValue);
    }
  }, [isPaceCoachEnabled, refreshProfile]);

  // 페이스 코치 체크 함수
  const PACE_CHECK_INTERVAL_KM = 0.005; // 5m 단위 테스트용

  const checkPaceCoachIfNeeded = useCallback(async (currentBucket: number, distanceKm: number) => {
    if (!isPaceCoachEnabled || currentBucket <= lastCheckedBucket || distanceKm <= 0) {
      return;
    }

    // 현재 페이스 계산 (초/km)
    const currentPaceSeconds = displayElapsedSec > 0 && displayDistance > 0
      ? Math.floor(displayElapsedSec / displayDistance)
      : 0;

    if (currentPaceSeconds <= 0) return;

    try {
      const response = await checkPaceCoach({
        session_id: t.sessionId || `journey-${Date.now()}`,
        current_km: Number(distanceKm.toFixed(3)),
        current_pace_seconds: currentPaceSeconds,
      });

      setLastCheckedBucket(currentBucket);

      // 알림이 필요한 경우 팝업 표시
      if (response.should_alert && response.alert_message) {
        setPaceAlertMessage(response.alert_message);
        setPaceAlertVisible(true);

        // 3초 후 자동으로 닫기
        setTimeout(() => {
          setPaceAlertVisible(false);
        }, 3000);
      }
    } catch (error) {
      console.error('[PaceCoach] 체크 실패:', error);
      // 에러는 조용히 처리 (러닝 방해 안 되게)
    }
  }, [isPaceCoachEnabled, lastCheckedBucket, displayElapsedSec, displayDistance, t.sessionId]);

  // km 통과 감지 (러닝 중일 때만)
  useEffect(() => {
    if (!t.isRunning || t.isPaused || !isPaceCoachEnabled) return;

    const currentBucket = Math.floor(displayDistance / PACE_CHECK_INTERVAL_KM);

    if (currentBucket > lastCheckedBucket && currentBucket > 0) {
      checkPaceCoachIfNeeded(currentBucket, displayDistance);
    }
  }, [displayDistance, t.isRunning, t.isPaused, isPaceCoachEnabled, checkPaceCoachIfNeeded, lastCheckedBucket, PACE_CHECK_INTERVAL_KM]);

  // 랜드마크 메뉴가 열릴 때 상세 정보 로드
  useEffect(() => {
    if (landmarkMenuVisible && menuLandmark) {
      const fetchLandmarkDetail = async () => {
        try {
          const detail = await getLandmarkDetail(
            parseInt(menuLandmark.id),
            userId ?? undefined
          );
          setLandmarkDetail(detail);
        } catch (err) {
          console.error("[JourneyRunning] 랜드마크 상세 로드 실패:", err);
          setLandmarkDetail(null);
        }
      };
      fetchLandmarkDetail();
    } else {
      setLandmarkDetail(null);
    }
  }, [landmarkMenuVisible, menuLandmark, userId]);

  // 진행ID 및 수집된 스탬프 목록 로드
  useEffect(() => {
    if (userId == null) return;
    let alive = true;
    (async () => {
      try {
        const pid = await getOrFetchProgressId(userId, journeyId);
        if (!alive) return;
        setProgressId(pid);
        if (pid) {
          const list = await getProgressStamps(pid);
          if (!alive) return;
          const ids = new Set<number>(
            list
              .map((s) => s.landmark?.id)
              .filter((v): v is number => v != null)
          );
          setCollectedSet(ids);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [userId, journeyId]);

  // 워치 동기화 초기화
  useEffect(() => {
    if (isWatchAvailable()) {
      console.log("[JourneyRunning] Initializing watch sync");
      initWatchSync();
    }
  }, []);

  // 워치 모드일 때 실시간 데이터 구독
  useEffect(() => {
    if (!watchMode) return;

    console.log("[JourneyRunning] Subscribing to watch updates");

    // 실시간 데이터 구독
    const unsubscribeUpdates = subscribeRealtimeUpdates((data) => {
      console.log("[JourneyRunning] Watch data received:", data);
      setWatchData(data);

      // 첫 데이터 수신 시 러닝 시작으로 간주
      if (!watchRunning) {
        setWatchRunning(true);

        // AsyncStorage에 러닝 세션 저장 (탭 바 숨김용)
        try {
          AsyncStorage.setItem(
            "@running_session",
            JSON.stringify({
              isRunning: true,
              sessionId: data.sessionId,
              startTime: Date.now(),
            })
          ).catch(() => {});
        } catch {}

        // 즉시 탭바 숨김 반영
        try {
          emitRunningSession(true);
        } catch {}
      }
    });

    // wearStarted 이벤트 리스너 추가
    const { NativeModules, NativeEventEmitter } = require("react-native");
    const { WayToEarthWear } = NativeModules;
    const emitter = new NativeEventEmitter(WayToEarthWear);

    const startedSub = emitter.addListener("wearStarted", (payload: string) => {
      console.log("[JourneyRunning] Watch session started:", payload);
      setWatchRunning(true);
    });

    // wearRunningComplete 이벤트 리스너 추가 (워치에서 종료 버튼 누름)
    const completeSub = emitter.addListener(
      "wearRunningComplete",
      async (payload: string) => {
        console.log("[JourneyRunning] Watch session completed:", payload);

        try {
          // payload 파싱
          const completeData = JSON.parse(payload);
          console.log("[JourneyRunning] Parsed complete data:", completeData);

          // 완료 데이터 저장
          setWatchCompleteData(completeData);

          // 워치 러닝 종료
          setWatchRunning(false);

          // 🔧 폰 러닝 트래커도 중지 (혹시 실행 중이었다면)
          try {
            if (t.isRunning) {
              await t.stop();
            }
          } catch (e) {
            console.error("[JourneyRunning] Failed to stop phone tracker:", e);
          }

          // AsyncStorage 세션 정보 제거
          try { await AsyncStorage.removeItem("@running_session"); } catch {}

          // 저장 확인 다이얼로그 표시
          setConfirmSave(true);
        } catch (e) {
          console.error("[JourneyRunning] Failed to parse complete data:", e);
        }
      }
    );

    // wearRunIdReceived 이벤트 리스너 추가 (서버에서 runId 수신)
    const runIdSub = emitter.addListener(
      "wearRunIdReceived",
      (payload: string) => {
        console.log("[JourneyRunning] Watch runId received:", payload);

        try {
          const data = JSON.parse(payload);
          console.log("[JourneyRunning] Parsed runId data:", data);

          // watchCompleteData 업데이트
          setWatchCompleteData((prev) => {
            if (prev && prev.sessionId === data.sessionId) {
              return { ...prev, runId: data.runId };
            }
            return prev;
          });
        } catch (e) {
          console.error("[JourneyRunning] Failed to parse runId data:", e);
        }
      }
    );

    return () => {
      unsubscribeUpdates();
      startedSub.remove();
      completeSub.remove();
      runIdSub.remove();
    };
  }, [watchMode, watchRunning]);

  // 날씨 정보 (이 화면에서만 위치/날씨 활성화)
  const {
    weather,
    loading: weatherLoading,
    enable: enableWeather,
    disable: disableWeather,
  } = useWeather();
  useEffect(() => {
    try {
      enableWeather();
    } catch {}
    return () => {
      try {
        disableWeather();
      } catch {}
    };
  }, []);

  // 다음 랜드마크 계산
  // 도달한 랜드마크 ID 목록을 훅의 landmarksWithReached에서 파생
  const reachedIds = useMemo(
    () => t.landmarksWithReached.filter((lm) => lm.reached).map((lm) => lm.id),
    [t.landmarksWithReached]
  );

  const nextLandmark = useMemo(() => {
    const remaining = landmarks.filter((lm) => !reachedIds.includes(lm.id));
    return remaining[0]?.name;
  }, [landmarks, reachedIds]);

  // 러닝 세션 상태 업데이트
  useEffect(() => {
    const isRunningNow = t.isRunning || watchRunning;
    if (!isRunningNow) return;

    const session = {
      type: "journey" as const,
      journeyId,
      journeyTitle,
      sessionId: t.sessionId,
      startTime: Date.now() - displayElapsedSec * 1000,
      distanceKm: displayDistance,
      durationSeconds: displayElapsedSec,
      isRunning: isRunningNow,
      isPaused: t.isPaused,
      reachedLandmarks: reachedIds,
    };

    // Foreground Service 업데이트
    backgroundRunning.updateForegroundService(session, nextLandmark);

    // 세션 상태 저장 (백그라운드 복원용)
    backgroundRunning.saveSession(session);
  }, [t.isRunning, watchRunning, displayDistance, displayElapsedSec, t.isPaused, nextLandmark]);

  // 러닝 시작 시 Foreground Service 시작
  useEffect(() => {
    const isRunningNow = t.isRunning || watchRunning;
    if (isRunningNow) {
      const session = {
        type: "journey" as const,
        journeyId,
        journeyTitle,
        sessionId: t.sessionId,
        startTime: Date.now() - displayElapsedSec * 1000,
        distanceKm: displayDistance,
        durationSeconds: displayElapsedSec,
        isRunning: true,
        isPaused: t.isPaused,
        reachedLandmarks: reachedIds,
      };
      backgroundRunning.startForegroundService(session);
    }
  }, [t.isRunning, watchRunning]);

  // 컴포넌트 언마운트 시 세션 정리 (완료/취소 시)
  useEffect(() => {
    return () => {
      if (!t.isRunning) {
        backgroundRunning.stopForegroundService();
        backgroundRunning.clearSession();
      }
    };
  }, []);

  // 위치 업데이트마다 50m 반경 자동 수집 시도
  useEffect(() => {
    if (!t.isRunning || t.isPaused) return;
    if (!progressId) return;
    const last = t.route?.length ? t.route[t.route.length - 1] : null;
    if (!last) return;

    const target = landmarks.find((lm) => {
      const id = parseInt(lm.id);
      if (collectedSet.has(id) || collectingRef.current.has(id)) return false;
      const pos = lm.position as LatLng | undefined;
      if (!pos) return false;
      const d = distanceKm(last, pos) * 1000;
      return d <= 50;
    });
    if (!target) return;

    const idNum = parseInt(target.id);
    collectingRef.current.add(idNum);
    (async () => {
      try {
        const can = await checkCollection(progressId, idNum);
        if (!can) return;
        await collectStampForProgress(progressId, idNum, {
          latitude: last.latitude,
          longitude: last.longitude,
        });
        setCollectedSet((prev) => new Set(prev).add(idNum));
        try {
          setCelebrate({ visible: true, count: 1 });
          setTimeout(() => setCelebrate({ visible: false }), 3200);
        } catch {}
        Alert.alert(
          `🎉 ${target.name} 도착!`,
          "스탬프를 획득했습니다! 랜드마크에 방명록을 남겨보세요."
        );
      } catch (e) {
        // 무시: 다음 업데이트에서 재시도
      } finally {
        setTimeout(() => collectingRef.current.delete(idNum), 4000);
      }
    })();
  }, [
    t.route?.length,
    t.isRunning,
    t.isPaused,
    progressId,
    landmarks,
    collectedSet,
  ]);

  const handleStartPress = useCallback(() => {
    console.log("[JourneyRunning] start pressed -> show countdown");

    // 워치 연결 확인
    if (watchStatus.isConnected) {
      console.log("[JourneyRunning] Watch connected, using watch mode");
      setWatchMode(true);
    } else {
      console.log("[JourneyRunning] Watch not connected, using phone-only mode");
      setWatchMode(false);
      // 폰 모드에서만 GPS 가열
      try {
        (t as any).prime?.();
      } catch {}
    }

    setCountdownVisible(true);
  }, [watchStatus.isConnected]);

  const handleCountdownDone = useCallback(async () => {
    console.log("[JourneyRunning] countdown done, watchMode:", watchMode);
    setCountdownVisible(false);

    // 페이스 코치 체크 초기화
    setLastCheckedKm(0);

    if (watchMode) {
      // 워치 모드: 워치 세션만 시작 (폰 GPS는 시작하지 않음)
      try {
        console.log("[JourneyRunning] Starting watch session (JOURNEY)");
        const sessionId = await startRunOrchestrated("JOURNEY", { journeyId: Number(journeyId) });
        console.log("[JourneyRunning] Watch session started:", sessionId);

        // ✅ 워치 러닝 상태 시작 (UI 표시용)
        setWatchRunning(true);

        // 🔧 워치 모드에서도 폰 GPS 시작 (지도 마커 표시용)
        // 거리/시간은 워치 데이터 우선 사용 (displayDistance, displayElapsedSec)
        requestAnimationFrame(() => {
          console.log("[JourneyRunning] calling t.startJourneyRun() (watch mode - GPS for map marker)");
          t.startJourneyRun();
        });

        // 탭바 숨김 즉시 반영 및 세션 플래그 저장
        try {
          await AsyncStorage.setItem(
            "@running_session",
            JSON.stringify({
              isRunning: true,
              sessionId,
              startTime: Date.now(),
            })
          );
        } catch {}
        try {
          emitRunningSession(true);
        } catch {}

        // 워치 연동 팝업 표시
        setAlert({
          open: true,
          title: "워치 연동",
          message: "워치와 연동되어 여정 러닝을 시작합니다",
        });
      } catch (error) {
        console.error("[JourneyRunning] Watch start failed, fallback to phone mode:", error);
        // 워치 시작 실패 시 폰 모드로 전환
        setWatchMode(false);
        setWatchRunning(false);
        requestAnimationFrame(() => {
          t.startJourneyRun();
        });
        setAlert({
          open: true,
          title: "워치 연동 실패",
          message: "폰 모드로 여정 러닝을 시작합니다",
        });
      }
    } else {
      // 폰 전용 모드: 기존 로직
      requestAnimationFrame(() => {
        console.log("[JourneyRunning] calling t.startJourneyRun() (phone mode)");
        t.startJourneyRun();
      });
      // 탭바 숨김 즉시 반영 및 세션 플래그 저장
      try {
        await AsyncStorage.setItem(
          "@running_session",
          JSON.stringify({
            isRunning: true,
            sessionId: t.sessionId || `journey-${Date.now()}`,
            startTime: Date.now(),
          })
        );
      } catch {}
      try {
        emitRunningSession(true);
      } catch {}
    }

    // 알림 권한 요청은 비동기로 병렬 처리
    backgroundRunning.requestNotificationPermission().catch(() => {});
  }, [watchMode, t, backgroundRunning, journeyId]);

  // 러닝 상태 변화에 따라 탭바 상태 즉시 동기화(보조 안전장치)
  useEffect(() => {
    const running = t.isRunning || watchRunning;
    try {
      emitRunningSession(!!running);
    } catch {}
  }, [t.isRunning, watchRunning]);

  // 랜드마크 마커 클릭 핸들러 - 스토리 페이지로 이동
  const handleLandmarkMarkerPress = useCallback(
    (landmark: any) => {
      console.log("[JourneyRunning] 랜드마크 마커 클릭:", landmark.name);
      navigation?.navigate("LandmarkStoryScreen", {
        landmarkId: parseInt(landmark.id),
        userId: userId ?? undefined,
        distanceM: Number(
          (landmark as any)?.distanceM ??
            (landmark as any)?.distanceFromStart ??
            NaN
        ),
      });
    },
    [navigation, userId]
  );

  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  const handleComplete = useCallback(async () => {
    // 먼저 일시정지 상태로 전환
    if (!t.isPaused) {
      t.pause();
    }
    setConfirmExit(true);
  }, [navigation, t, journeyTitle, backgroundRunning, journeyId]);

  // 🔧 워치 모드일 때는 워치 데이터 우선 사용
  const displayDistance = useMemo(() => {
    if (watchMode && watchData?.distanceMeters != null) {
      return watchData.distanceMeters / 1000; // 미터를 km로 변환
    }
    return t.distance;
  }, [watchMode, watchData?.distanceMeters, t.distance]);

  const displayElapsedSec = useMemo(() => {
    if (watchMode && watchData?.durationSeconds != null) {
      return watchData.durationSeconds;
    }
    return t.elapsedSec;
  }, [watchMode, watchData?.durationSeconds, t.elapsedSec]);

  const displayPace = useMemo(() => {
    if (watchMode && watchData?.averagePaceSeconds != null) {
      const paceMin = Math.floor(watchData.averagePaceSeconds / 60);
      const paceSec = Math.floor(watchData.averagePaceSeconds % 60);
      return `${paceMin}'${String(paceSec).padStart(2, "0")}"`;
    }
    return t.paceLabel;
  }, [watchMode, watchData?.averagePaceSeconds, t.paceLabel]);

  const displayKcal = useMemo(() => {
    if (watchMode && watchData?.calories != null) {
      return watchData.calories;
    }
    return t.kcal;
  }, [watchMode, watchData?.calories, t.kcal]);

  const elapsedLabel = useMemo(() => {
    const m = Math.floor(displayElapsedSec / 60);
    const s = String(displayElapsedSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [displayElapsedSec]);

  // 진행률에 따른 여정 경로 상의 가상 위치 계산 (거리 기반으로 수정)
  const virtualLocation = useMemo(() => {
    if (!t.progressReady) return null; // 진행률 로드 전에는 계산 생략
    if (journeyRoute.length === 0) return null;
    if (journeyRoute.length === 1) return journeyRoute[0];

    // 🔧 수정: 각 랜드마크 사이를 거리 비율로 분할
    // 현재 진행 거리로 어느 구간에 있는지 찾기
    let currentSegmentStart = 0;
    let currentSegmentEnd =
      landmarks.length > 1 ? landmarks[1].distanceM : totalDistanceKm * 1000;
    let segmentStartIdx = 0;
    let segmentEndIdx = 0;
    if (landmarks.length > 1) {
      const lm1 = landmarks[1] as any;
      const hasPos =
        lm1 &&
        lm1.position &&
        typeof lm1.position.latitude === "number" &&
        typeof lm1.position.longitude === "number";
      if (hasPos) {
        segmentEndIdx = journeyRoute.findIndex(
          (p) =>
            Math.abs(p.latitude - lm1.position.latitude) < 0.0001 &&
            Math.abs(p.longitude - lm1.position.longitude) < 0.0001
        );
      }
      if (!hasPos || segmentEndIdx < 0) {
        // 거리 비율로 근사 인덱스 산출
        const ratio = Math.min(
          1,
          Math.max(0, (lm1.distanceM || 0) / (totalDistanceKm * 1000))
        );
        segmentEndIdx = Math.floor(ratio * (journeyRoute.length - 1));
      }
    } else {
      segmentEndIdx = journeyRoute.length - 1;
    }

    // 현재 어느 랜드마크 구간에 있는지 찾기
    for (let i = 0; i < landmarks.length; i++) {
      // 🔧 수정: <= 대신 < 사용 (랜드마크 정확히 도달 시 다음 구간으로)
      if (t.progressM <= landmarks[i].distanceM || i === landmarks.length - 1) {
        currentSegmentEnd = landmarks[i].distanceM;
        currentSegmentStart = i > 0 ? landmarks[i - 1].distanceM : 0;

        // 해당 랜드마크의 경로 인덱스 산출(좌표 있으면 최근접, 없으면 비율 근사)
        const landmark = landmarks[i] as any;
        const hasPos =
          landmark &&
          landmark.position &&
          typeof landmark.position.latitude === "number" &&
          typeof landmark.position.longitude === "number";
        if (hasPos) {
          let minDist = 999999;
          segmentEndIdx = journeyRoute.length - 1; // 기본값: 마지막 포인트
          journeyRoute.forEach((point, idx) => {
            const dist = Math.sqrt(
              Math.pow(point.latitude - landmark.position.latitude, 2) +
                Math.pow(point.longitude - landmark.position.longitude, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              segmentEndIdx = idx;
            }
          });
        } else {
          const ratio = Math.min(
            1,
            Math.max(0, (landmark?.distanceM || 0) / (totalDistanceKm * 1000))
          );
          segmentEndIdx = Math.floor(ratio * (journeyRoute.length - 1));
        }

        if (i > 0) {
          const prevLandmark = landmarks[i - 1] as any;
          const hasPrev =
            prevLandmark &&
            prevLandmark.position &&
            typeof prevLandmark.position.latitude === "number" &&
            typeof prevLandmark.position.longitude === "number";
          if (hasPrev) {
            let minDist = 999999;
            segmentStartIdx = 0; // 기본값: 첫 포인트
            journeyRoute.forEach((point, idx) => {
              const dist = Math.sqrt(
                Math.pow(point.latitude - prevLandmark.position.latitude, 2) +
                  Math.pow(point.longitude - prevLandmark.position.longitude, 2)
              );
              if (dist < minDist) {
                minDist = dist;
                segmentStartIdx = idx;
              }
            });
          } else {
            const ratioStart = Math.min(
              1,
              Math.max(
                0,
                (prevLandmark?.distanceM || 0) / (totalDistanceKm * 1000)
              )
            );
            segmentStartIdx = Math.floor(
              ratioStart * (journeyRoute.length - 1)
            );
          }
        } else {
          segmentStartIdx = 0; // 첫 번째 구간의 시작은 0
        }

        break;
      }
    }

    // 구간 내에서의 진행 비율 계산
    const segmentDistance = currentSegmentEnd - currentSegmentStart;
    const progressInSegment = t.progressM - currentSegmentStart;
    const segmentRatio =
      segmentDistance > 0 ? progressInSegment / segmentDistance : 0;

    // 경로 포인트 인덱스 계산
    const indexRange = segmentEndIdx - segmentStartIdx;
    const exactIndex = segmentStartIdx + indexRange * segmentRatio;
    const beforeIndex = Math.floor(exactIndex);
    const afterIndex = Math.min(beforeIndex + 1, journeyRoute.length - 1);
    const ratio = exactIndex - beforeIndex;

    const clamp = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, n));
    const idxA = clamp(beforeIndex, 0, journeyRoute.length - 1);
    const idxB = clamp(afterIndex, 0, journeyRoute.length - 1);
    const pointA = journeyRoute[idxA];
    const pointB = journeyRoute[idxB];

    // 방어: 경로가 부족하거나 ratio가 비정상이면 안전한 포인트 반환
    if (!pointA || !pointB || !Number.isFinite(ratio)) {
      return {
        location: pointA || journeyRoute[0],
        routeIndex: idxA,
      } as any;
    }

    // 선형 보간
    const interpolated = {
      latitude: pointA.latitude + (pointB.latitude - pointA.latitude) * ratio,
      longitude:
        pointA.longitude + (pointB.longitude - pointA.longitude) * ratio,
    };

    return {
      location: interpolated,
      routeIndex: exactIndex, // 경로 인덱스도 함께 반환
    };
  }, [journeyRoute, t.progressM, landmarks, totalDistanceKm]);

  // 가상 위치와 인덱스 분리
  const virtualLocationPoint = virtualLocation?.location || null;
  const virtualRouteIndex = virtualLocation?.routeIndex || 0;
  const centerMapRef = useRef<() => void>(() => {});

  // journeyId가 없으면 안전 중단
  if (!journeyId) {
    return (
      <SafeLayout withBottomInset>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text>
            여정 정보가 올바르지 않습니다. 목록에서 다시 진입해주세요.
          </Text>
        </View>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout withBottomInset>
      <JourneyMapRoute
        key={`jr-map-${mapKey}`}
        journeyRoute={journeyRoute}
        landmarks={useMemo(
          () => t.landmarksWithReached,
          [
            t.landmarksWithReached
              .map(
                (l) =>
                  `${l.id}:${l.reached ? 1 : 0}:${l.position.latitude.toFixed(
                    6
                  )},${l.position.longitude.toFixed(6)}`
              )
              .join("|"),
          ]
        )}
        userRoute={[]} // 여정 러닝에서는 실제 GPS 경로 표시 안 함
        currentLocation={virtualLocationPoint}
        currentAvatarUrl={focusAvatarUrl}
        progressPercent={t.progressPercent}
        virtualRouteIndex={virtualRouteIndex}
        onLandmarkPress={handleLandmarkMarkerPress}
        onBindCenter={(fn) => (centerMapRef.current = fn)}
      />

      {/* 날씨 위젯 */}
      <View
        style={{
          position: "absolute",
          top: Math.max(insets.top, 12) + 12,
          left: 16,
          zIndex: 10,
        }}
      >
        <WeatherWidget
          emoji={weather?.emoji}
          condition={weather?.condition}
          temperature={weather?.temperature}
          recommendation={weather?.recommendation}
          loading={weatherLoading}
        />
      </View>

      {/* 러닝 중이 아닐 때: 여정 진행률 카드 */}
      {!t.isRunning && !t.isPaused && !watchRunning && t.progressReady && (
          <JourneyProgressCard
            progressPercent={t.progressPercent}
            currentDistanceKm={t.progressM / 1000}
            totalDistanceKm={totalDistanceKm}
          nextLandmark={
            t.nextLandmark
              ? {
                  name: t.nextLandmark.name,
                  distanceKm: t.nextLandmark.distanceM / 1000,
                  id: parseInt(t.nextLandmark.id),
                }
              : null
          }
          onPressGuestbook={(landmarkId) => {
            const landmark = landmarks.find(
              (lm) => parseInt(lm.id) === landmarkId
            );
            if (landmark) {
              navigation?.navigate("LandmarkGuestbookScreen", {
                landmarkId,
                landmarkName: landmark.name,
              });
            }
          }}
          onPressCenter={() => { try { centerMapRef.current?.(); } catch {} }}
        />
      )}

      {/* 종료 확인 & 저장 팝업 (조건부 렌더링 밖에 배치) */}
      <ConfirmAlert
        visible={confirmExit}
        title="여정 러닝 종료"
        message="러닝을 종료하시겠습니까?"
        onClose={() => setConfirmExit(false)}
        onCancel={() => {
          setConfirmExit(false);
          if (t.isPaused) t.resume();
        }}
        onConfirm={() => {
          setConfirmExit(false);
          setConfirmSave(true);
        }}
        confirmText="종료"
      />
      <ConfirmAlert
        visible={confirmSave}
            title="기록 저장"
            message="러닝 기록을 저장하시겠습니까?"
            onClose={() => setConfirmSave(false)}
            onCancel={async () => {
              setConfirmSave(false);
              try {
                await backgroundRunning.stopForegroundService();
                await backgroundRunning.clearSession();
                if (!watchMode) {
                  await t.stop();
                }
                try { await AsyncStorage.removeItem('@running_session'); } catch {}
                try { emitRunningSession(false); } catch {}

                // 워치 모드 리셋
                setWatchMode(false);
                setWatchRunning(false);
                setWatchData(null);
                setWatchCompleteData(null);

                navigation.navigate('JourneyRouteDetail', { id: journeyId });
              } catch (e) {
                console.error('[JourneyRunning] 종료 실패:', e);
              }
            }}
            onConfirm={async () => {
              setConfirmSave(false);
              try {
                // 워치 모드인지 폰 모드인지 확인
                if (watchMode && watchCompleteData) {
                  // 워치 모드: watchCompleteData 사용 (watchSync.ts에서 이미 서버에 complete 전송됨)
                  const distanceMeters =
                    watchCompleteData.totalDistanceMeters ||
                    watchCompleteData.distanceMeters ||
                    0;
                  const distanceKm = distanceMeters / 1000;

                  // 워치 모드: 여정 진행률 업데이트
                  const deltaM = distanceMeters;
                  console.log("[JourneyRunning] 💾 워치 완료: 진행률 저장", {
                    deltaM,
                    distanceKm: (deltaM / 1000).toFixed(2),
                  });

                  try {
                    await t.completeJourneyRun(); // 여정 진행률 저장
                  } catch (e) {
                    console.error('[JourneyRunning] 여정 진행률 저장 실패:', e);
                  }

                  await backgroundRunning.stopForegroundService();
                  await backgroundRunning.clearSession();

                  // 워치 모드 리셋
                  setWatchMode(false);
                  setWatchRunning(false);
                  setWatchData(null);
                  setWatchCompleteData(null);

                  try { await AsyncStorage.removeItem('@running_session'); } catch {}
                  try { emitRunningSession(false); } catch {}

                  navigation.navigate('JourneyRouteDetail', { id: journeyId });
                } else {
                  // 폰 모드: 기존 로직
                  const avgPaceSec = t.distance > 0 && Number.isFinite(t.elapsedSec / t.distance)
                    ? Math.floor(t.elapsedSec / Math.max(t.distance, 0.000001))
                    : null;
                  const now = Math.floor(Date.now() / 1000);
                  const routePoints = (t.route ?? []).map((p, i) => ({ latitude: p.latitude, longitude: p.longitude, sequence: i + 1, t: now }));
                  await apiComplete({
                    sessionId: t.sessionId as string,
                    distanceMeters: Math.round(t.distance * 1000),
                    durationSeconds: t.elapsedSec,
                    averagePaceSeconds: avgPaceSec,
                    calories: Math.round(t.kcal),
                    routePoints,
                    endedAt: Date.now(),
                    title: journeyTitle,
                  });
                  try { if (t.distance >= 0.01) await awardEmblemByCode('DIST_10M'); } catch {}
                  await backgroundRunning.stopForegroundService();
                  await backgroundRunning.clearSession();
                  await t.completeJourneyRun();
                  await t.stop();
                  try { await AsyncStorage.removeItem('@running_session'); } catch {}
                  try { emitRunningSession(false); } catch {}

                  navigation.navigate('JourneyRouteDetail', { id: journeyId });
                }
              } catch (e) {
                console.error('[JourneyRunning] 저장 종료 실패:', e);
                Alert.alert('저장 실패', '네트워크 또는 서버 오류가 발생했어요.');
              }
            }}
            confirmText="저장"
            cancelText="저장 안 함"
          />

      {/* 러닝 중일 때: 사이드 패널(통계) + 간소화된 진행률 */}
      {(t.isRunning || t.isPaused || watchRunning) && (
        <>
          {/* 오른쪽 사이드 패널 (여정 러닝 전용) */}
          <RunStatsSidePanel
            distanceKm={displayDistance}
            paceLabel={displayPace}
            kcal={displayKcal}
            elapsedSec={displayElapsedSec}
          />

          {/* 간소화된 진행률 표시 */}
          <View style={styles.compactProgressCard}>
            <View style={styles.compactHeader}>
              <Text style={styles.compactTitle}>여정 진행</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => { try { centerMapRef.current?.(); } catch {} }}
                  style={({ pressed }) => [styles.iconBtnSmall, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel="가상 현재 위치로 이동"
                >
                  <Ionicons name="locate-outline" size={14} color="#111827" />
                </Pressable>
                <Text style={styles.compactPercent}>
                  {t.progressPercent.toFixed(1)}%
                </Text>
              </View>
            </View>
            <View style={styles.compactProgressBar}>
              <LinearGradient
                colors={["#10B981", "#34D399", "#6EE7B7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.compactProgressFill,
                  { width: `${Math.min(100, t.progressPercent)}%` },
                ]}
              />
            </View>
            {t.nextLandmark && (
              <Text style={styles.compactNextLandmark}>
                다음: {t.nextLandmark.name} (
                {(() => {
                  const remaining =
                    (t.nextLandmark.distanceM - t.progressM) / 1000;
                  return remaining.toFixed(1);
                })()}{" "}
                km)
              </Text>
            )}
          </View>
        </>
      )}

      {/* 일시정지 오버레이 */}
      {t.isPaused && (
        <>
          {/* 배경 흐림 효과 */}
          <View pointerEvents="none" style={styles.pauseBlurOverlay} />

          {/* 일시정지 텍스트 */}
          <View pointerEvents="none" style={styles.pauseTextContainer}>
            <Text style={styles.pauseTitle}>일시정지</Text>
            <Text style={styles.pauseDesc}>
              재생 ▶ 을 누르면 다시 시작됩니다.
            </Text>
            <Text style={styles.pauseDesc}>
              종료하려면 ■ 버튼을 2초간 길게 누르세요.
            </Text>
          </View>
        </>
      )}

      {/* 시작 버튼 (러닝 전) */}
      {!t.isRunning && !t.isPaused && !watchRunning && (
        <View
          style={[
            styles.startButtonContainer,
            { bottom: Math.max(insets.bottom, 12) + 100 }, // 스탬프 바텀시트(90px) 위
          ]}
        >
          <View style={styles.startButtonRow}>
            {/* AI 페이스 코치 토글 버튼 */}
            <Pressable
              onPress={handlePaceCoachToggle}
              style={({ pressed }) => [
                styles.paceCoachToggle,
                isPaceCoachEnabled && styles.paceCoachToggleActive,
                pressed && styles.paceCoachTogglePressed,
              ]}
            >
              <View style={{ position: 'relative' }}>
                <Text style={{ fontSize: 24 }}>🎯</Text>
                {!isPaceCoachEnabled && (
                  <View style={styles.disabledSlash} />
                )}
              </View>
            </Pressable>

            {/* 시작 버튼 */}
            <Pressable
              onPress={handleStartPress}
              disabled={!t.isReady || t.isInitializing}
              style={styles.startButtonWrapper}
            >
              <View
                style={[
                  styles.startButton,
                  (!t.isReady || t.isInitializing) && styles.startButtonDisabled,
                ]}
              >
                <Text style={styles.startButtonText}>
                  {!t.isReady
                    ? "준비중..."
                    : t.isInitializing
                    ? "시작중..."
                    : "여정 시작"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      )}

      {/* 러닝 제어 버튼 (러닝 중) - 워치 모드가 아닐 때만 표시 */}
      {t.isRunning && !watchMode && (
        <View style={styles.playControlsContainer}>
          <RunPlayControls
            isRunning={t.isRunning}
            isPaused={t.isPaused}
            onPlay={() => t.start()}
            onPause={() => t.pause()}
            onResume={() => t.resume()}
            onStopTap={() => Alert.alert("종료하려면 길게 누르세요")}
            onStopLong={handleComplete}
          />
        </View>
      )}

      {/* 워치 제어 중 메시지 + 디버그 정보 */}
      {watchRunning && watchMode && (
        <View style={styles.watchControlContainer}>
          <Text style={styles.watchControlText}>
            ⌚ 워치에서 제어 중
          </Text>
          {__DEV__ && t.watchData && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 8, marginTop: 8 }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>
                🐛 워치 데이터: {(t.watchData.distanceMeters / 1000).toFixed(3)}km
              </Text>
              <Text style={{ color: '#fff', fontSize: 11 }}>
                시간: {Math.floor(t.watchData.durationSeconds / 60)}:{String(t.watchData.durationSeconds % 60).padStart(2, '0')}
              </Text>
              <Text style={{ color: '#fff', fontSize: 11 }}>
                칼로리: {t.watchData.calories || 0}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 카운트다운 오버레이 */}
      <CountdownOverlay
        visible={countdownVisible}
        seconds={3}
        onDone={handleCountdownDone}
      />

      {/* Emblem Celebration */}
      {celebrate.visible && <EmblemCelebration count={celebrate.count} />}

      {/* 워치 연동 팝업 */}
      <MessageAlert
        visible={alert.open}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ open: false })}
      />

      {/* 페이스 코치 알림 팝업 */}
      {paceAlertVisible && (
        <View style={styles.paceAlertOverlay} pointerEvents="none">
          <View style={styles.paceAlertBox}>
            <View style={styles.paceAlertIcon}>
              <Ionicons name="speedometer" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.paceAlertTitle}>페이스 알림</Text>
            <Text style={styles.paceAlertMessage}>{paceAlertMessage}</Text>
          </View>
        </View>
      )}

      {/* 방명록 작성 모달 */}
      {selectedLandmark && (
        <GuestbookCreateModal
          visible={guestbookModalVisible}
          onClose={() => {
            setGuestbookModalVisible(false);
            setSelectedLandmark(null);
          }}
          landmark={selectedLandmark}
          userId={1} // TODO: 실제 userId로 교체
          onSuccess={() => {
            console.log("[JourneyRunning] 방명록 작성 완료");
          }}
        />
      )}

      {/* 랜드마크 메뉴 바텀시트 */}
      <Modal
        visible={!countdownVisible && landmarkMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLandmarkMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLandmarkMenuVisible(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            {menuLandmark && (
              <>
                {/* 랜드마크 이미지 캐러셀 */}
                {(() => {
                  // 1. 랜드마크 대표 이미지 (imageUrl)
                  // 2. 랜드마크 갤러리 이미지들 (images[])
                  const carouselImages: string[] = [];

                  if (landmarkDetail?.imageUrl) {
                    carouselImages.push(landmarkDetail.imageUrl);
                  }

                  if (
                    landmarkDetail?.images &&
                    Array.isArray(landmarkDetail.images)
                  ) {
                    const galleryUrls = landmarkDetail.images
                      .map((img: any) =>
                        typeof img === "string" ? img : img?.imageUrl
                      )
                      .filter(
                        (url): url is string =>
                          url !== null && url !== undefined && url.trim() !== ""
                      );
                    carouselImages.push(...galleryUrls);
                  }

                  return (
                    <ImageCarousel
                      images={carouselImages}
                      height={180}
                      borderRadius={0}
                      autoPlayInterval={4000}
                    />
                  );
                })()}

                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>
                    {menuLandmark.name}
                  </Text>
                  <Text style={styles.bottomSheetSubtitle}>
                    {menuLandmark.distance}
                  </Text>
                </View>

                {/* 랜드마크 통계 */}
                <View style={styles.statisticsContainer}>
                  <LandmarkStatistics landmarkId={parseInt(menuLandmark.id)} />
                </View>

                {/* 메뉴 옵션 */}
                <View style={styles.menuOptions}>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      setLandmarkMenuVisible(false);
                      const landmarkSummary: LandmarkSummary = {
                        id: parseInt(menuLandmark.id),
                        name: menuLandmark.name,
                        cityName: "서울",
                        countryCode: "KR",
                        imageUrl: "",
                      };
                      setSelectedLandmark(landmarkSummary);
                      setGuestbookModalVisible(true);
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color="#111827"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.menuOptionText}>방명록 작성</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      setLandmarkMenuVisible(false);
                      navigation?.navigate("LandmarkGuestbookScreen", {
                        landmarkId: parseInt(menuLandmark.id),
                        landmarkName: menuLandmark.name,
                      });
                    }}
                  >
                    <Ionicons
                      name="book-outline"
                      size={20}
                      color="#111827"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.menuOptionText}>방명록 보기</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuOption, styles.menuOptionCancel]}
                    onPress={() => setLandmarkMenuVisible(false)}
                  >
                    <Text style={styles.menuOptionText}>닫기</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* 스탬프 바텀시트(스와이프 업) - 카운트다운 중에는 숨김 */}
      {!countdownVisible && userId != null && (
        <StampBottomSheet
          userId={userId}
          journeyId={journeyId}
          progressPercent={t.progressPercent}
          landmarks={landmarks.map((l) => ({
            id: parseInt(l.id),
            name: l.name,
            distanceM: l.distanceM,
          }))}
          currentLocation={t.route?.length ? t.route[t.route.length - 1] : null}
          currentProgressM={t.progressM}
          onCollected={(res: StampResponse) => {
            const id = res?.landmark?.id;
            if (typeof id === "number")
              setCollectedSet((prev) => new Set(prev).add(id));
            try {
              setCelebrate({ visible: true, count: 1 });
              setTimeout(() => setCelebrate({ visible: false }), 3200);
            } catch {}
          }}
        />
      )}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  pauseBlurOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  pauseTextContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
    color: "#fff",
  },
  pauseDesc: {
    color: "#fff",
    marginTop: 2,
    fontSize: 14,
  },
  playControlsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110, // 스탬프 바텀시트(90px) 바로 위
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonWrapper: {
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  startButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  startButtonDisabled: {
    shadowOpacity: 0,
    backgroundColor: "rgba(243, 244, 246, 0.8)",
  },
  startButtonIcon: {
    fontSize: 20,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  compactProgressCard: {
    position: "absolute",
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  compactTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  compactPercent: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6366F1",
    textShadowColor: "rgba(99, 102, 241, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  compactProgressBar: {
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  compactProgressFill: {
    height: "100%",
    borderRadius: 3,
    shadowColor: "#10B981",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  iconBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  compactNextLandmark: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    minHeight: 400,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  bottomSheetHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  statisticsContainer: {
    marginBottom: 20,
  },
  menuOptions: {
    gap: 12,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  menuOptionCancel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  watchControlContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110, // 스탬프 바텀시트 위
    alignItems: "center",
  },
  watchControlText: {
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // 페이스 코치 관련 스타일
  startButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paceCoachToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 2,
    borderColor: "rgba(107, 114, 128, 0.2)",
  },
  paceCoachToggleActive: {
    backgroundColor: "#10B981",
    borderColor: "#059669",
  },
  paceCoachTogglePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  disabledSlash: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    height: 2,
    backgroundColor: '#EF4444',
    transform: [{ translateX: -16 }, { translateY: -1 }, { rotate: '-45deg' }],
    borderRadius: 1,
  },
  paceAlertOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 80,
    zIndex: 999,
  },
  paceAlertBox: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 20,
    padding: 20,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 2,
    borderColor: "#F59E0B",
    maxWidth: "85%",
  },
  paceAlertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  paceAlertTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  paceAlertMessage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
    textAlign: "center",
    lineHeight: 20,
  },
});
