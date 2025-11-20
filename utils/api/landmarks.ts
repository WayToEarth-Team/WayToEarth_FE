// utils/api/landmarks.ts
// 랜드마크 스토리 API 유틸리티

import { client } from '@utils/api/client';
import type { LandmarkDetail, StoryCard, LandmarkSummary, StoryType } from '@types/landmark';
import { distanceKm } from '@utils/geo';

/**
 * 랜드마크 상세 조회 (스토리 포함)
 * @param landmarkId 랜드마크 ID
 * @param userId 사용자 ID (스탬프 수집 여부 확인용, 선택)
 */
export async function getLandmarkDetail(
  landmarkId: number,
  userId?: number // string → number로 변경
): Promise<LandmarkDetail> {
  const params = userId ? { userId } : {};
  const response = await client.get<LandmarkDetail>(
    `/v1/landmarks/${landmarkId}`,
    { params }
  );
  const data = response.data as any;

  // distanceFromStart가 0이거나 누락된 경우, routeDistance를 활용해 보정 시도
  if ((data?.distanceFromStart ?? 0) === 0 && typeof data?.routeDistance === 'object') {
    try {
      const route = Array.isArray(data.routeDistance?.points) ? data.routeDistance.points : [];
      if (route.length >= 2) {
        // 누적 거리 계산
        let cumulative = 0;
        for (let i = 1; i < route.length; i++) {
          const prev = route[i - 1];
          const cur = route[i];
          const seg = distanceKm(
            { latitude: prev.latitude, longitude: prev.longitude },
            { latitude: cur.latitude, longitude: cur.longitude }
          ) * 1000;
          cumulative += Number.isFinite(seg) ? seg : 0;
          // 현재 랜드마크 위치와 가장 가까운 포인트를 찾기 위해 거리 측정
          const distToCur = distanceKm(
            { latitude: data.latitude, longitude: data.longitude },
            { latitude: cur.latitude, longitude: cur.longitude }
          ) * 1000;
          if (distToCur < 30) {
            data.distanceFromStart = cumulative;
            break;
          }
        }
      }
    } catch (e) {
      // 보정 실패 시 그대로 반환
    }
  }

  return data as LandmarkDetail;
}

/**
 * 랜드마크의 스토리 카드 목록 조회
 * @param landmarkId 랜드마크 ID
 * @param type 스토리 타입 필터 (선택)
 */
export async function getLandmarkStories(
  landmarkId: number,
  type?: StoryType
): Promise<StoryCard[]> {
  const params = type ? { type } : {};
  const response = await client.get<StoryCard[]>(
    `/v1/landmarks/${landmarkId}/stories`,
    { params }
  );
  return response.data;
}

/**
 * 개별 스토리 카드 조회
 * @param storyCardId 스토리 카드 ID
 */
export async function getStoryCard(storyCardId: number): Promise<StoryCard> {
  const response = await client.get<StoryCard>(`/v1/story-cards/${storyCardId}`);
  return response.data;
}

/**
 * 여정의 랜드마크 목록 조회
 * @param journeyId 여정 ID
 */
export async function getJourneyLandmarks(journeyId: number): Promise<LandmarkSummary[]> {
  // 여러 환경을 지원하기 위해 순차 폴백
  const tryEndpoints = [
    `/v1/landmarks/journey/${journeyId}`,
    `/v1/journeys/${journeyId}/landmarks`,
    `/v1/landmarks`, // ?journeyId= 로 내려올 수도 있음
  ];

  let list: any[] = [];
  let lastErr: any = null;
  for (const ep of tryEndpoints) {
    try {
      const params = ep.endsWith('/landmarks') || ep === '/v1/landmarks' ? { params: { journeyId } } : undefined as any;
      const { data } = await client.get(ep, params);
      const raw = data?.data ?? data;
      list = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
      if (list.length > 0) break; // 성공
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  if (!list || list.length === 0 && lastErr) {
    // 마지막 에러를 무시하고 빈 배열 반환(화면 안전성 우선)
    // console.warn('[landmarks] failed to load by all endpoints:', lastErr);
  }

  // 다양한 백엔드 필드명을 수용하여 distanceFromStart를 미터 단위로 표준화
  const mapOne = (lm: any): LandmarkSummary => {
    const kmVal = lm?.distanceFromStartKm ?? lm?.distance_km ?? lm?.distanceKm;
    const mRaw = lm?.distanceFromStart ?? lm?.distance_from_start ?? lm?.distanceMeters ?? lm?.distance_m ?? lm?.distance;
    let distanceFromStart: number;
    if (kmVal != null) {
      // 명시적인 km 값이 있으면 km → m 변환
      distanceFromStart = Number(kmVal) * 1000;
    } else if (mRaw != null) {
      // 스웨거 예시처럼 distanceFromStart가 km일 수도 있어 휴리스틱으로 보정
      const v = Number(mRaw);
      const looksLikeKm = v > 0 && v < 1000 && String(mRaw).includes('.') ;
      distanceFromStart = looksLikeKm ? v * 1000 : v;
    } else {
      distanceFromStart = 0;
    }

    return {
      id: Number(lm?.id ?? lm?.landmarkId ?? 0),
      name: String(lm?.name ?? lm?.title ?? ''),
      description: String(lm?.description ?? lm?.summary ?? ''),
      latitude: Number(lm?.latitude ?? lm?.lat ?? 0),
      longitude: Number(lm?.longitude ?? lm?.lng ?? lm?.lon ?? 0),
      distanceFromStart: Number.isFinite(distanceFromStart) ? distanceFromStart : 0,
      orderIndex: Number(lm?.orderIndex ?? lm?.order ?? lm?.sequence ?? 0),
      imageUrl: lm?.imageUrl ?? lm?.thumbnailUrl ?? null,
    } as LandmarkSummary;
  };

  return list.map(mapOne);
}
