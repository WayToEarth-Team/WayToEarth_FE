// hooks/journey/useJourneyRunning.ts
// 여정 러닝 추적 훅 (싱글 러닝 + 여정 진행률 연동)

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveRunTracker } from "@features/running/hooks/useLiveRunTracker";
import type { LatLng } from "@types/types";
import type { JourneyId, Landmark } from "@types/journey";
import * as userJourneysApi from "@utils/api/userJourneys";

type JourneyLandmark = {
  id: string;
  name: string;
  position: LatLng;
  distance: string;
  distanceM: number;
  reached: boolean;
};

type UseJourneyRunningProps = {
  journeyId: JourneyId;
  userId: string;
  totalDistanceM: number;
  landmarks: JourneyLandmark[];
  journeyRoute: LatLng[];
  onLandmarkReached?: (landmark: JourneyLandmark) => void;
};

export function useJourneyRunning({
  journeyId,
  userId,
  totalDistanceM,
  landmarks,
  journeyRoute,
  onLandmarkReached,
}: UseJourneyRunningProps) {
  const runTracker = useLiveRunTracker("JOURNEY"); // 여정 러닝은 JOURNEY 타입

  const [progressM, setProgressM] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressReady, setProgressReady] = useState(false);
  const [nextLandmark, setNextLandmark] = useState<JourneyLandmark | null>(null);
  const [reachedLandmarks, setReachedLandmarks] = useState<Set<string>>(new Set());

  const initialProgressM = useRef(0);
  const hasStarted = useRef(false);

  // 초기 진행률 로드
  useEffect(() => {
    const loadInitialProgress = async () => {
      try {
        console.log("[useJourneyRunning] 📥 진행률 로드 시작:", {
          userId,
          journeyId,
          totalDistanceKm: (totalDistanceM / 1000).toFixed(2),
        });

        // 랜드마크 기준으로 다음 랜드마크까지 거리 계산 (간소화)
        const nextLm = landmarks.find((lm) => !lm.reached);
        const nextLandmarkDistM = nextLm?.distanceM ?? 0;

        const progress = await userJourneysApi.getState(
          userId,
          journeyId,
          totalDistanceM,
          nextLandmarkDistM
        );

        console.log("[useJourneyRunning] ✅ 서버에서 불러온 진행률:", {
          progressM: progress.progressM,
          progressKm: (progress.progressM / 1000).toFixed(2),
          percent: progress.percent.toFixed(2),
          message: progress.message,
        });

        initialProgressM.current = progress.progressM;
        setProgressM(progress.progressM);
        setProgressPercent(progress.percent);
        setProgressReady(true);

        // 이미 도달한 랜드마크 표시
        const reached = new Set<string>();
        landmarks.forEach((lm) => {
          if (progress.progressM >= lm.distanceM) {
            reached.add(lm.id);
          }
        });
        setReachedLandmarks(reached);

        // 다음 랜드마크 설정
        const next = landmarks.find((lm) => progress.progressM < lm.distanceM);
        setNextLandmark(next || null);

        console.log("[useJourneyRunning] 📌 초기화 완료:", {
          reachedLandmarks: Array.from(reached),
          nextLandmark: next?.name || "없음",
        });
      } catch (error) {
        console.error("[useJourneyRunning] ❌ 진행률 로드 실패:", { userId, journeyId, error });
      } finally {
        setProgressReady(true);
      }
    };

    loadInitialProgress();
  }, [journeyId, userId, totalDistanceM, landmarks]);

  // 러닝 거리 변경 시 진행률 업데이트
  useEffect(() => {
    console.log("[useJourneyRunning] 거리 업데이트 체크:", {
      isRunning: runTracker.isRunning,
      distance: runTracker.distance,
      route: runTracker.route.length,
    });

    if (!runTracker.isRunning) return;

    const currentTotalM = initialProgressM.current + runTracker.distance * 1000;
    setProgressM(currentTotalM);
    setProgressPercent(
      totalDistanceM > 0 ? Math.min(100, (currentTotalM / totalDistanceM) * 100) : 0
    );

    console.log("[useJourneyRunning] 진행률 업데이트:", {
      initialProgressM: initialProgressM.current,
      runTrackerDistance: runTracker.distance,
      currentTotalM,
      totalDistanceM,
      progressPercent: ((currentTotalM / totalDistanceM) * 100).toFixed(4),
    });

    // 랜드마크 도달 체크
    landmarks.forEach((lm) => {
      if (currentTotalM >= lm.distanceM && !reachedLandmarks.has(lm.id)) {
        setReachedLandmarks((prev) => new Set(prev).add(lm.id));
        // 랜드마크 도달 콜백 실행
        onLandmarkReached?.(lm);
      }
    });

    // 다음 랜드마크 업데이트
    const next = landmarks.find((lm) => currentTotalM < lm.distanceM);
    setNextLandmark(next || null);
  }, [
    runTracker.isRunning,
    runTracker.distance,
    landmarks,
    totalDistanceM,
    reachedLandmarks,
    onLandmarkReached,
  ]);

  // 러닝 시작
  const startJourneyRun = useCallback(async () => {
    if (hasStarted.current) return;

    try {
      console.log('[useJourneyRunning] ▶ 여정 시작 시도', { userId, journeyId, prevProgressM: initialProgressM.current });
      // 여정 시작: 항상 시도(서버가 이미 시작된 경우 409를 반환할 수 있음)
      try {
        await userJourneysApi.start(userId, journeyId);
        console.log('[useJourneyRunning] ✅ /v1/journeys/{id}/start ok');
      } catch (e: any) {
        const code = e?.code || e?.response?.status;
        if (code === 409) {
          console.log('[useJourneyRunning] ℹ️ 이미 시작된 여정(409). 계속 진행');
        } else {
          console.error('[useJourneyRunning] ❌ 여정 시작 실패, 서버 500 가능', e);
          // 500 등 비정상 응답 시에도 진행ID가 이미 존재할 수 있으므로 재조회 시도
          try {
            const state = await userJourneysApi.getState(userId, journeyId, totalDistanceM, 0);
            if (state && (state.progressM >= 0)) {
              console.log('[useJourneyRunning] ↺ 진행률 재조회로 대체 진행', { progressM: state.progressM, percent: state.percent });
              initialProgressM.current = state.progressM;
              setProgressM(state.progressM);
              setProgressPercent(state.percent);
            } else {
              throw e;
            }
          } catch (e2) {
            throw e; // 상위에서 사용자에게 안내
          }
        }
      }

      // 시작 직후 진행률 다시 확보(진행 ID 보장)
      try {
        const state = await userJourneysApi.getState(userId, journeyId, totalDistanceM, 0);
        initialProgressM.current = state.progressM;
        setProgressM(state.progressM);
        setProgressPercent(state.percent);
        console.log('[useJourneyRunning] ↺ 진행률 재조회', { progressM: state.progressM, percent: state.percent });
      } catch (e) {
        console.warn('[useJourneyRunning] 진행률 재조회 실패(계속 진행)', e);
      }

      hasStarted.current = true;
      await runTracker.start({ journeyId });
    } catch (error) {
      console.error("여정 러닝 시작 실패:", error);
      throw error;
    }
  }, [userId, journeyId, runTracker, totalDistanceM]);

  // 러닝 완료 시 진행률 서버 업데이트
  const completeJourneyRun = useCallback(async () => {
    if (!runTracker.isRunning && !runTracker.isPaused) return;

    try {
      const deltaM = runTracker.distance * 1000;

      console.log("[useJourneyRunning] 💾 진행률 저장 시작:", {
        userId,
        journeyId,
        이번러닝거리: `${(deltaM / 1000).toFixed(2)}km`,
        기존진행: `${(initialProgressM.current / 1000).toFixed(2)}km`,
        새진행: `${((initialProgressM.current + deltaM) / 1000).toFixed(2)}km`,
      });

      // 서버에 진행률 업데이트
      const result = await userJourneysApi.progress(
        userId,
        journeyId,
        totalDistanceM,
        deltaM
      );

      console.log("[useJourneyRunning] ✅ 진행률 저장 완료:", {
        progressM: result.progressM,
        progressKm: (result.progressM / 1000).toFixed(2),
        percent: result.percent.toFixed(2),
        message: result.message,
      });

      runTracker.stop();
      hasStarted.current = false;
    } catch (error) {
      console.error("[useJourneyRunning] ❌ 여정 진행률 업데이트 실패:", { userId, journeyId, error });
      throw error;
    }
  }, [
    userId,
    journeyId,
    totalDistanceM,
    progressM,
    landmarks,
    runTracker,
  ]);

  // 랜드마크에 reached 속성 추가
  const landmarksWithReached = landmarks.map((lm) => ({
    ...lm,
    reached: reachedLandmarks.has(lm.id),
  }));

  // 🧪 테스트용: 강제로 거리 증가
  const addTestDistance = useCallback((metersToAdd: number) => {
    const newProgressM = progressM + metersToAdd;

    // 🔧 수정: initialProgressM도 함께 증가시켜야 함!
    initialProgressM.current = newProgressM;

    setProgressM(newProgressM);
    setProgressPercent(
      totalDistanceM > 0 ? Math.min(100, (newProgressM / totalDistanceM) * 100) : 0
    );

    console.log("[useJourneyRunning] 🧪 테스트 거리 추가:", {
      added: metersToAdd,
      newProgressM,
      initialProgressM: initialProgressM.current,
      progressPercent: ((newProgressM / totalDistanceM) * 100).toFixed(4),
    });

    // 랜드마크 도달 체크
    landmarks.forEach((lm) => {
      if (newProgressM >= lm.distanceM && !reachedLandmarks.has(lm.id)) {
        setReachedLandmarks((prev) => new Set(prev).add(lm.id));
        onLandmarkReached?.(lm);
      }
    });

    // 다음 랜드마크 업데이트
    const next = landmarks.find((lm) => newProgressM < lm.distanceM);
    setNextLandmark(next || null);
  }, [progressM, totalDistanceM, landmarks, reachedLandmarks, onLandmarkReached]);

  // ────────────────────────────────────────────────────────────────────────────
  // 서버 동기화/리로드(개발용)
  const refreshProgress = useCallback(async () => {
    try {
      console.log('[useJourneyRunning] ↻ refreshProgress', { userId, journeyId });
      const state = await userJourneysApi.getState(userId, journeyId, totalDistanceM, 0);
      initialProgressM.current = state.progressM;
      setProgressM(state.progressM);
      setProgressPercent(state.percent);
      // 랜드마크 재계산
      const reached = new Set<string>();
      landmarks.forEach((lm) => { if (state.progressM >= lm.distanceM) reached.add(lm.id); });
      setReachedLandmarks(reached);
      const next = landmarks.find((lm) => state.progressM < lm.distanceM);
      setNextLandmark(next || null);
      return state;
    } catch (e) {
      console.error('[useJourneyRunning] refreshProgress failed:', { userId, journeyId, e });
      throw e;
    }
  }, [userId, journeyId, totalDistanceM, landmarks]);

  const syncServerProgress = useCallback(async (deltaMeters: number) => {
    try {
      console.log('[useJourneyRunning] ⇡ syncServerProgress', { userId, journeyId, deltaMeters });
      const res = await userJourneysApi.progress(userId, journeyId, totalDistanceM, deltaMeters);
      initialProgressM.current = res.progressM;
      setProgressM(res.progressM);
      setProgressPercent(res.percent);
      // 랜드마크 재계산
      const reached = new Set<string>();
      landmarks.forEach((lm) => { if (res.progressM >= lm.distanceM) reached.add(lm.id); });
      setReachedLandmarks(reached);
      const next = landmarks.find((lm) => res.progressM < lm.distanceM);
      setNextLandmark(next || null);
      return res;
    } catch (e) {
      console.error('[useJourneyRunning] syncServerProgress failed:', { userId, journeyId, e });
      throw e;
    }
  }, [userId, journeyId, totalDistanceM, landmarks]);

  return {
    // 기본 러닝 추적 데이터
    ...runTracker,

    // 여정 관련 데이터
    progressM,
    progressPercent,
    nextLandmark,
    landmarksWithReached,

    // 여정 러닝 제어
    startJourneyRun,
    completeJourneyRun,

    // 상태
    progressReady,

    // 🧪 테스트용
    addTestDistance,
    // 서버 확인용(개발)
    refreshProgress,
    syncServerProgress,
  };
}
