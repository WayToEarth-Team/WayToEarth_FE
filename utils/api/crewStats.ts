import { client } from "./client";
import type { TopCrewItemData } from "../../types/Crew";

// Fetch top crew rankings by monthly total distance
// Swagger: GET /v1/crews/statistics/rankings/distance
// Query: month (YYYYMM, optional), limit (default 10)
type CrewRankingDto = {
  month?: string;
  crewId: number;
  crewName: string;
  totalDistance: number; // km
  runCount?: number;
  rank: number;
};

export async function getTopCrewsByDistance(
  params?: { month?: string; limit?: number }
): Promise<TopCrewItemData[]> {
  const { month, limit = 3 } = params || {};
  const { data } = await client.get("/v1/crews/statistics/rankings/distance", {
    params: { month, limit },
  });
  const list = (data ?? []) as CrewRankingDto[];
  return list.slice(0, limit).map((r) => ({
    id: String(r.crewId),
    rank: `${r.rank}등 크루`,
    name: r.crewName,
    distance: `${formatKm(r.totalDistance)}`,
  }));
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
