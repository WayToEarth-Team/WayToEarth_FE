// utils/api/journeyRoutes.ts
import { client } from "./client";
import { getMyProfile } from "./users";
import * as userJourneys from "./userJourneys";
import type { LandmarkSummary } from "../../types/landmark";
import { getJourneyLandmarks } from "./landmarks";

export type RouteId = string | number;

// 백엔드 Journey 타입(요약)
export type Journey = {
  id: number;
  title: string;
  description: string;
  totalDistanceKm: number;
  category: "DOMESTIC" | "INTERNATIONAL";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  estimatedDays: number;
  thumbnailUrl: string;
  completedUserCount?: number;
  runningTogether?: number; // 함께 뛰는 러너 수
};

// 여정 경로 좌표 타입
export type JourneyRoute = {
  sequence: number;
  latitude: number;
  longitude: number;
};

// 여정의 랜드마크 요약 타입 (공유 타입을 재사용)
export type JourneyLandmark = LandmarkSummary;

// 프론트 호환 타입
export type RouteSummary = {
  id: RouteId;
  title: string;
  description: string;
  distance: string;
  duration: string;
  difficulty: "쉬움" | "보통" | "어려움" | string;
  completed: number;
  total: number;
  image: string;
  tags: string[];
  runningTogether?: number; // 함께 뛰는 러너 수
  category?: "DOMESTIC" | "INTERNATIONAL"; // 필터용 카테고리
};

export type Landmark = {
  id: string;
  name: string;
  distance: string;
  completed?: boolean;
};

export type RouteDetail = RouteSummary & { landmarks?: Landmark[] };

const difficultyMap: Record<string, "쉬움" | "보통" | "어려움"> = {
  EASY: "쉬움",
  MEDIUM: "보통",
  HARD: "어려움",
};

function mapJourneyToSummary(j: Journey): RouteSummary {
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    distance: `${j.totalDistanceKm}Km`,
    duration: `${j.estimatedDays}일`,
    difficulty: difficultyMap[j.difficulty] || "보통",
    completed: 0,
    total: j.completedUserCount || 0,
    image: j.thumbnailUrl || "palace",
    tags: [],
    runningTogether: j.runningTogether, // 함께 뛰는 러너 수
    category: j.category,
  };
}

// 목록
export async function listRoutes(category?: "DOMESTIC" | "INTERNATIONAL"): Promise<RouteSummary[]> {
  const res = await client.get("/v1/journeys", { params: { category } });
  const arr: any[] = Array.isArray(res.data) ? res.data : res.data?.content ?? [];
  console.log('[JourneyRoutes] API Response Sample:', JSON.stringify(arr[0], null, 2));
  return arr.map((x: any) => mapJourneyToSummary({
    id: Number(x.id ?? x.journeyId ?? 0),
    title: String(x.title ?? x.name ?? ""),
    description: String(x.description ?? x.summary ?? ""),
    totalDistanceKm: Number(x.totalDistanceKm ?? x.distanceKm ?? x.total_distance_km ?? 0),
    category: (x.category as any) ?? "DOMESTIC",
    difficulty: (x.difficulty as any) ?? "MEDIUM",
    estimatedDays: Number(x.estimatedDays ?? x.days ?? 0),
    thumbnailUrl: String(x.thumbnailUrl ?? x.imageUrl ?? ""),
    completedUserCount: Number(x.completedUserCount ?? x.completed ?? 0),
    runningTogether: Number(x.runningTogether ?? 0), // 함께 뛰는 러너 수
  } as Journey));
}

// 상세 + 랜드마크
export async function getRouteDetail(id: RouteId): Promise<RouteDetail> {
  console.log('[ROUTE][detail] fetch', { id: String(id) });
  const [journeyRes] = await Promise.all([
    client.get(`/v1/journeys/${id}`),
  ]);
  const j: any = journeyRes.data?.data ?? journeyRes.data ?? {};
  const summary = mapJourneyToSummary({
    id: Number(j.id ?? id),
    title: String(j.title ?? j.name ?? ""),
    description: String(j.description ?? j.summary ?? ""),
    totalDistanceKm: Number(j.totalDistanceKm ?? j.distanceKm ?? j.total_distance_km ?? 0),
    category: (j.category as any) ?? "DOMESTIC",
    difficulty: (j.difficulty as any) ?? "MEDIUM",
    estimatedDays: Number(j.estimatedDays ?? j.days ?? 0),
    thumbnailUrl: String(j.thumbnailUrl ?? j.imageUrl ?? ""),
    completedUserCount: Number(j.completedUserCount ?? j.completed ?? 0),
    runningTogether: Number(j.runningTogether ?? 0), // 함께 뛰는 러너 수
  } as Journey);

  // 랜드마크는 공용 유틸을 통해 로드(엔드포인트 폴백/매핑 포함)
  let lms: any[] = [];
  try {
    const list = await getJourneyLandmarks(Number(id));
    lms = list as any[];
  } catch {
    lms = [];
  }

  // 현재 사용자 진행률을 조회해 랜드마크 완료 상태를 보정
  let progressM = 0;
  try {
    const me = await getMyProfile();
    const totalM = Number((journeyRes.data?.data ?? journeyRes.data)?.totalDistanceKm ?? 0) * 1000;
    const nextDistM = 0;
    const state = await userJourneys.getState(String(me.id), String(id), totalM, nextDistM);
    progressM = Number(state.progressM || 0);
    console.log('[ROUTE][detail] progress snapshot', { id: String(id), userId: String(me.id), progressKm: (progressM / 1000).toFixed(2), percent: state.percent });
  } catch {}

  const totalKm = summary.totalDistanceKm || Number(j.totalDistanceKm ?? 0);
  const landmarks: Landmark[] = lms.map((lm: any) => {
    const kmVal = lm?.distanceFromStartKm ?? lm?.distance_km ?? lm?.distanceKm;
    const mRaw = lm?.distanceFromStart ?? lm?.distance_m ?? lm?.distance ?? lm?.distanceMeters;
    let distM: number;
    if (kmVal != null) {
      distM = Number(kmVal) * 1000;
    } else if (mRaw != null) {
      const v = Number(mRaw);
      // 총 여정 거리(totalKm) 정보를 활용해 정수값(v)이 km인지 판정
      const looksLikeKmInt = totalKm > 0 && v > 0 && v <= totalKm + 1 && Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;
      const looksLikeKmDecimal = v > 0 && v < 1000 && String(mRaw).includes('.');
      distM = (looksLikeKmInt || looksLikeKmDecimal) ? v * 1000 : v;
    } else {
      distM = 0;
    }
    return {
      id: String(lm.id ?? lm.landmarkId ?? ""),
      name: String(lm.name ?? lm.title ?? ""),
      distance: `${(distM / 1000).toFixed(1)}km 지점`,
      completed: Boolean(lm.completed ?? lm.visited ?? (progressM > 0 && distM <= progressM)),
    } as Landmark;
  });

  return { ...summary, landmarks };
}

/**
 * 여정 경로 좌표 조회 (전체)
 */
export async function getJourneyRoutes(journeyId: RouteId): Promise<JourneyRoute[]> {
  const response = await client.get<JourneyRoute[]>(`/v1/journeys/${journeyId}/routes/all`);
  return response.data;
}
