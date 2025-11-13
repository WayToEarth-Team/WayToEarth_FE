import { client } from "./client";
import type { TopCrewItemData } from "../../types/Crew";

// Fetch top crew rankings by monthly total distance
// Swagger: GET /v1/crews/statistics/rankings/distance
// Query: month (YYYYMM, optional), limit (default 10)
// Server may return different shapes depending on version.
// Normalize across possible keys.
type CrewRankingDto = any;

export async function getTopCrewsByDistance(
  params?: { month?: string; limit?: number }
): Promise<TopCrewItemData[]> {
  const { month, limit = 3 } = params || {};
  const fetchOnce = async (m?: string) => {
    const { data } = await client.get("/v1/crews/statistics/rankings/distance", {
      params: { month: m, limit },
    });
    const raw = data as any;
    const arr: CrewRankingDto[] = Array.isArray(raw?.content)
      ? raw.content
      : (Array.isArray(raw) ? raw : []);
    const normalized = (arr as any[]).map((r: any, idx: number) => {
      const id = r.crewId ?? r.id ?? r.crew?.id;
      const name = r.crewName ?? r.name ?? r.crew?.name ?? "크루";
      const distRaw = r.totalDistance ?? r.distance ?? r.total_distance ?? r.total_distance_km ?? 0;
      const rank = r.rank ?? idx + 1;
      return {
        id: String(id ?? ""),
        rank: `${rank}위 크루`,
        name: String(name),
        distance: `${formatKm(Number(String(distRaw).replace(/[^\d.]/g, "")) || 0)}`,
        imageUrl: r.imageUrl ?? r.crew?.profileImageUrl ?? null,
      } as TopCrewItemData;
    });
    return normalized as TopCrewItemData[];
  };

  let list: TopCrewItemData[] = [];
  try {
    list = await fetchOnce(month);
  } catch {}
  // Fallback: if empty or failed and month provided, retry without month
  if ((!list || list.length === 0) && month) {
    try {
      list = await fetchOnce(undefined);
    } catch {}
  }
  return (list || []).slice(0, limit);
}

function formatKm(n: number) {
  if (!isFinite(n as any)) return "0km";
  // show up to 1 decimal when needed
  const v = Math.round(n * 10) / 10;
  return v % 1 === 0 ? `${v | 0}km` : `${v}km`;
}

// Crew monthly summary
// Swagger: GET /v1/crews/statistics/{crewId}/monthly -> CrewStatisticsSummaryDto
export type CrewMonthlySummary = {
  month?: string;
  totalCrews?: number; // may be unused in per-crew API
  totalDistance?: number; // km
  totalActiveMembers?: number;
  averagePace?: number; // min/km
};

export async function getCrewMonthlySummary(
  crewId: string,
  month?: string
): Promise<CrewMonthlySummary | null> {
  const { data } = await client.get(`/v1/crews/statistics/${crewId}/monthly`, {
    params: { month },
  });
  return (data ?? null) as CrewMonthlySummary | null;
}

// Crew member ranking within a crew
// Swagger: GET /v1/crews/statistics/{crewId}/members/ranking -> CrewMemberRankingDto[]
export type CrewMemberRanking = {
  month?: string;
  userId: number;
  userName: string;
  totalDistance: number;
  runCount?: number;
  rank: number;
};

export async function getCrewMemberRanking(
  crewId: string,
  params?: { month?: string; limit?: number }
): Promise<CrewMemberRanking[]> {
  const { month, limit = 10 } = params || {};
  const { data } = await client.get(
    `/v1/crews/statistics/${crewId}/members/ranking`,
    { params: { month, limit } }
  );
  return (data ?? []) as CrewMemberRanking[];
}
