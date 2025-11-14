// utils/api/stamps.ts
// 스탬프 API: 수집/조회/확인/통계 (서버 규격에 맞춤)
import { client } from "./client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JourneyId } from "../../types/journey";

export type Coordinates = { latitude: number; longitude: number };

export type StampResponse = {
  id: number;
  landmark: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    distanceFromStart?: number;
    imageUrl?: string;
    countryCode?: string;
    cityName?: string;
  };
  collectedAt: string;
  stampImageUrl?: string;
};

export type StampStatistics = {
  totalStamps: number;
  completedJourneys: number;
};

const progressKey = (userId: string | number, journeyId: JourneyId) =>
  `@journey_progress_id:${userId}:${journeyId}`;

async function loadProgressId(userId: string | number, journeyId: JourneyId) {
  try {
    const v = await AsyncStorage.getItem(progressKey(String(userId), journeyId));
    return v || null;
  } catch {
    return null;
  }
}

export async function getOrFetchProgressId(
  userId: string | number,
  journeyId: JourneyId
): Promise<string | null> {
  // 1) 캐시에서 시도
  const cached = await loadProgressId(userId, journeyId);
  if (cached) return cached;
  // 2) 서버 단일 엔드포인트로 조회
  try {
    const uid = Number(userId);
    const jid = Number(journeyId as any);
    const one = await client.get(`/v1/journey-progress/user/${uid}/journey/${jid}`);
    const d: any = one.data?.data ?? one.data ?? null;
    const pid = d?.progressId ?? d?.id ?? null;
    return pid != null ? String(pid) : null;
  } catch {
    return null;
  }
}

// 수집 가능 여부 확인
export async function checkCollection(
  progressId: string | number,
  landmarkId: number
): Promise<boolean> {
  const res = await client.get(`/v1/stamps/check-collection`, {
    params: {
      progressId,
      landmarkId,
    },
  });
  // 서버가 boolean을 직접 반환하도록 설계됨(true/false)
  return Boolean(res.data?.data ?? res.data);
}

// 스탬프 수집(지급)
export async function collectStampForProgress(
  progressId: string | number,
  landmarkId: number,
  coords: Coordinates
): Promise<StampResponse> {
  const body = {
    progressId: Number(progressId),
    landmarkId: Number(landmarkId),
    collectionLocation: { latitude: coords.latitude, longitude: coords.longitude },
  };
  const res = await client.post(`/v1/stamps/collect`, body);
  return (res.data?.data ?? res.data) as StampResponse;
}

// 진행별 수집 목록
export async function getProgressStamps(progressId: string | number): Promise<StampResponse[]> {
  const res = await client.get(`/v1/stamps/progress/${progressId}`);
  const data = res.data?.data ?? res.data;
  return Array.isArray(data) ? (data as StampResponse[]) : (data?.content ?? []);
}

// 사용자 전체 스탬프 목록
export async function getUserStamps(userId: number): Promise<StampResponse[]> {
  const res = await client.get(`/v1/stamps/users/${userId}`);
  const data = res.data?.data ?? res.data;
  return Array.isArray(data) ? (data as StampResponse[]) : (data?.content ?? []);
}

// 사용자 통계
export async function getUserStampStatistics(userId: number): Promise<StampStatistics> {
  const res = await client.get(`/v1/stamps/users/${userId}/statistics`);
  return (res.data?.data ?? res.data) as StampStatistics;
}

// ───── 레거시 호환: 기존 collectStamp/claimStamp 서명 유지(권장하지 않음) ─────
export async function collectStamp(_userId: number, _landmarkId: number) {
  // 더 이상 사용 권장하지 않음: progressId/좌표가 필요합니다.
  // 서버 검증 실패 가능성이 높으므로 no-op에 가깝게 동작시킵니다.
  try {
    // 임시: 실패를 삼키고 기존 호출부가 죽지 않도록 true 반환
    return { success: false } as any;
  } catch {
    return { success: false } as any;
  }
}

export type ClaimBody = {
  journeyId: JourneyId;
  landmarkId: string;
  userLat: number;
  userLng: number;
  photo?: string;
  mood?: string;
  rating?: number;
  text?: string;
};

export async function claimStamp(body: ClaimBody) {
  const pid = await getOrFetchProgressId(0, body.journeyId); // 실제 userId는 서버 토큰 기반이라 불필요
  if (!pid) throw new Error("진행 ID를 찾을 수 없습니다.");
  const res = await collectStampForProgress(pid, Number(body.landmarkId), {
    latitude: body.userLat,
    longitude: body.userLng,
  });
  return { granted: Boolean(res?.id), stampId: String(res?.id ?? ""), newTotalStamps: 0 } as any;
}

// 방명록 API는 별도 파일 사용(이곳에서는 미구현)
export async function getGuestbook() {
  throw new Error("방명록 조회 API는 별도 모듈에서 처리합니다.");
}
export async function postGuestbook() {
  throw new Error("방명록 작성 API는 별도 모듈에서 처리합니다.");
}
export async function likeGuestbook() {
  throw new Error("방명록 좋아요 API는 별도 모듈에서 처리합니다.");
}
export async function reportGuestbook() {
  throw new Error("방명록 신고 API는 별도 모듈에서 처리합니다.");
}
