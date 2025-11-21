// utils/api/running.ts
import { client } from "@utils/api/client";
import { RoutePoint } from "@utils/api/types";

type RunningType = "SINGLE" | "JOURNEY";

// 실서버 세션 시작: /v1/running/start
export async function apiStart(payload: {
  sessionId: string;
  runningType?: RunningType;
  journeyId?: number;
}) {
  const body = {
    sessionId: payload.sessionId,
    runningType: payload.runningType ?? "SINGLE",
    ...(payload.journeyId != null ? { journeyId: payload.journeyId } : {}),
  };
  console.log("[API] 러닝 세션 시작 요청:", body);
  const { data } = await client.post("/v1/running/start", body);
  console.log("[API] 러닝 세션 시작 응답:", data);
  return data as { sessionId?: string } & Record<string, any>;
}

export async function apiUpdate(payload: {
  sessionId: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSeconds: number | null;
  calories: number;
  currentPoint: RoutePoint & { sequence: number };
}) {
  const body = {
    ...payload,
    averagePaceSeconds: payload.averagePaceSeconds ?? undefined, // null 회피
  };
  console.log("[API] 러닝 업데이트 요청:", {
    sessionId: body.sessionId,
    distanceMeters: body.distanceMeters,
    durationSeconds: body.durationSeconds,
    sequence: body.currentPoint.sequence,
  });
  const { data } = await client.post("/v1/running/update", body);
  console.log("[API] 러닝 업데이트 응답:", data);
  // Swagger 예시: { success, data: { ack: true } }
  return data;
}

export async function apiPause(payload: { sessionId: string }) {
  console.log("[API] 러닝 일시정지 요청:", payload);
  const { data } = await client.post("/v1/running/pause", payload);
  console.log("[API] 러닝 일시정지 응답:", data);
  return data;
}

export async function apiResume(payload: { sessionId: string }) {
  console.log("[API] 러닝 재개 요청:", payload);
  const { data } = await client.post("/v1/running/resume", payload);
  console.log("[API] 러닝 재개 응답:", data);
  return data;
}

export type CompletedRun = {
  runningRecordId: number;
  title?: string;
  totalDistanceKm?: number;
  averagePace?: string;
  calories?: number;
  startedAt?: string;
  endedAt?: string;
  routePoints?: Array<
    Pick<RoutePoint, "latitude" | "longitude"> & { sequence: number }
  >;
  emblemAwardResult?: { awarded_count: number; awarded_emblem_ids: number[] };
  runningType?: string;
  virtualCourseId?: number | null;
};

export async function apiComplete(payload: {
  sessionId: string;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSeconds: number | null;
  calories: number;
  routePoints: Array<
    Pick<RoutePoint, "latitude" | "longitude" | "t"> & { sequence: number }
  >;
  endedAt?: string | number;
  title?: string;
}): Promise<{ runId: number | null; data?: CompletedRun }> {

  // endedAt ISO 통일
  const endedAtIso = (() => {
    if (!payload.endedAt) return new Date().toISOString();
    const n =
      typeof payload.endedAt === "number"
        ? payload.endedAt
        : Date.parse(String(payload.endedAt));
    return isFinite(n) ? new Date(n).toISOString() : new Date().toISOString();
  })();

  // routePoints 정리(시퀀스 1부터, t 보정)
  const routePoints = payload.routePoints.map((p, i) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    sequence: i + 1,
    t: p.t ?? Math.floor(Date.now() / 1000),
  }));

  const body = {
    sessionId: payload.sessionId,
    distanceMeters: payload.distanceMeters,
    durationSeconds: payload.durationSeconds,
    averagePaceSeconds: payload.averagePaceSeconds ?? undefined,
    calories: payload.calories,
    routePoints,
    endedAt: endedAtIso,
    ...(payload.title ? { title: payload.title } : {}),
  };

  console.log("[API] 러닝 완료 요청:", {
    sessionId: body.sessionId,
    distanceMeters: body.distanceMeters,
    durationSeconds: body.durationSeconds,
    averagePaceSeconds: body.averagePaceSeconds,
    calories: body.calories,
    routePointsCount: routePoints.length,
    endedAt: body.endedAt,
    title: body.title,
  });

  const { data } = await client.post("/v1/running/complete", body);

  // Swagger: wrapper.data.runningRecordId
  const d: any = data;
  const runId =
    d?.runningRecordId ??
    d?.recordId ??
    d?.id ??
    d?.data?.runningRecordId ??
    null;
  return { runId, data: (d?.data ?? d) as CompletedRun };
}

// ---------- Additional GET APIs ----------

export type WeeklyStats = {
  totalDistance: number;
  totalDuration: number; // seconds
  averagePace: string; // mm:ss
  dailyDistances: Array<{ day: string; distance: number }>;
};

export async function getWeeklyStats(): Promise<WeeklyStats> {
  const { data } = await client.get("/v1/statistics/weekly");
  // data는 인터셉터에 의해 언래핑됨
  return data as WeeklyStats;
}

export type RunningRecordItem = {
  id: number;
  title?: string | null;
  distanceKm?: number;
  durationSeconds?: number;
  calories?: number;
  startedAt?: string;
  runningType?: "SINGLE" | "JOURNEY" | "GROUP" | string;
};

export async function listRunningRecords(
  limit = 10,
  offset = 0
): Promise<RunningRecordItem[]> {
  const page = Math.floor(offset / Math.max(1, limit));
  const { data } = await client.get("/v1/running/records", {
    params: { limit, offset, size: limit, page },
  });
  // 서버가 pagination wrapper를 줄 수 있어 content 안전 접근
  const items = (data?.content ?? data) as any[];
  return Array.isArray(items) ? items : [];
}

// Cursor-based pagination (preferred if backend supports)
export type CursorResult<T> = { items: T[]; nextCursor: string | null };

export async function listRunningRecordsByCursor(
  cursor: string | null | undefined,
  size = 10
): Promise<CursorResult<RunningRecordItem>> {
  const params: Record<string, any> = { size };
  if (cursor) params.cursor = cursor;
  const { data } = await client.get("/v1/running/records/cursor", { params });
  const d: any = data;
  const items: any[] = Array.isArray(d?.content)
    ? d.content
    : Array.isArray(d?.items)
    ? d.items
    : Array.isArray(d)
    ? d
    : [];
  const nextCursor: string | null =
    d?.nextCursor ?? d?.next_cursor ?? d?.next ?? d?.cursor ?? null;
  return {
    items: items.filter((it: any) => it && it.id != null) as RunningRecordItem[],
    nextCursor,
  };
}

export type RunningRecordDetail = {
  id: number;
  title?: string | null;
  totalDistanceKm?: number;
  totalDurationSec?: number;
  averagePace?: string | null;
  calories?: number;
  startedAt?: string;
  endedAt?: string;
  runningType?: string;
  routePoints?: Array<{
    latitude: number;
    longitude: number;
    sequence?: number;
  }>;
};

export async function getRunningRecordDetail(
  recordId: number
): Promise<RunningRecordDetail> {
  const { data } = await client.get(`/v1/running/${recordId}`);
  // 서버가 { data: {...} } 래퍼를 줄 수 있어 안전 언래핑
  const d: any =
    data && typeof data === "object" && "data" in data
      ? (data as any).data
      : data ?? {};
  return {
    id: d.id ?? recordId,
    title: d.title ?? d.name ?? null,
    totalDistanceKm:
      d.totalDistanceKm ??
      d.distanceKm ??
      d.total_distance_km ??
      d.totalDistance ??
      d.distance ??
      (typeof d.totalDistanceMeters === "number"
        ? d.totalDistanceMeters / 1000
        : typeof d.distanceMeters === "number"
        ? d.distanceMeters / 1000
        : undefined),
    totalDurationSec:
      d.totalDurationSec ??
      d.durationSeconds ??
      d.total_duration_sec ??
      d.totalDuration ??
      d.duration ??
      d.elapsedSec ??
      d.elapsedSeconds,
    averagePace: d.averagePace ?? d.avgPace ?? null,
    calories: d.calories ?? d.kcal,
    startedAt: d.startedAt ?? d.start_time ?? d.started_at,
    endedAt: d.endedAt ?? d.end_time ?? d.ended_at,
    runningType: d.runningType ?? d.type,
    routePoints: (d.routePoints ?? d.points ?? d.route_points ?? [])
      .map((p: any, i: number) => ({
        latitude: p.latitude ?? p.lat,
        longitude: p.longitude ?? p.lng,
        sequence: p.sequence ?? i + 1,
      }))
      .filter(
        (p: any) =>
          typeof p.latitude === "number" && typeof p.longitude === "number"
      ),
  } as RunningRecordDetail;
}

// ---------- Pace Coach API ----------

export type PaceCoachCheckRequest = {
  session_id: string;
  current_km: number;
  current_pace_seconds: number;
};

export type PaceCoachCheckResponse = {
  coach_enabled: boolean;
  is_available?: boolean;
  should_alert?: boolean;
  alert_message?: string;
  reference_pace_seconds?: number;
  reference_pace_formatted?: string;
  current_pace_seconds?: number;
  current_pace_formatted?: string;
  difference_seconds?: number;
  minimum_records_required?: number;
  current_records?: number;
  message?: string;
};

export async function checkPaceCoach(
  request: PaceCoachCheckRequest
): Promise<PaceCoachCheckResponse> {
  console.log("[API] 페이스 코치 체크 요청:", request);
  const { data } = await client.post("/v1/running/pace-coach/check", request);
  console.log("[API] 페이스 코치 체크 응답:", data);

  // 서버 응답이 { data: { ... } } 래퍼일 수 있으므로 안전하게 언래핑
  const d: any = data && typeof data === "object" && "data" in data ? (data as any).data : data;

  return d as PaceCoachCheckResponse;
}
