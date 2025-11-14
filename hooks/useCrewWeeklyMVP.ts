import { useEffect, useMemo, useState } from "react";
import { getCrewMemberRanking, type CrewMemberRanking } from "../utils/api/crewStats";
import { getAllCrewMembers } from "../utils/api/crews";

export type WeeklyItem = { day: string; distance: number };
export type RankingItem = { rank: number; name: string; distance: number; isUser?: boolean };

export function useCrewWeeklyMVP(crewId: string, opts?: { month?: string; limit?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<CrewMemberRanking[]>([]);

  const month = useMemo(() => {
    if (opts?.month) return opts.month;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}${m}`; // YYYYMM
  }, [opts?.month]);

  useEffect(() => {
    if (!crewId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [res, members] = await Promise.all([
          getCrewMemberRanking(crewId, { month, limit: opts?.limit ?? 5 }),
          getAllCrewMembers(crewId).catch(() => []),
        ]);
        if (!alive) return;
        // enrich ranking with profile images
        const byId = new Map<string, string | null>();
        for (const m of members as any[]) {
          byId.set(String((m as any).id), (m as any).profileImage ?? null);
        }
        const enriched = (res || []).map((r) => ({ ...r, _imageUrl: byId.get(String(r.userId)) ?? null }));
        // @ts-ignore - store temporarily
        setRanking(enriched as any);
      } catch (e: any) {
        if (!alive) return;
        const msg = e?.response?.data?.message || e?.message || "MVP 데이터를 불러오지 못했습니다.";
        setError(msg);
        setRanking([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [crewId, month, opts?.limit]);

  const rankingData: RankingItem[] = useMemo(() => {
    return (ranking || []).map((r: any) => ({
      rank: r.rank,
      name: r.userName,
      distance: r.totalDistance,
      isUser: false, // TODO: 현재 사용자 식별되면 true 처리
      imageUrl: r._imageUrl ?? null,
    }));
  }, [ranking]);

  // 주간 데이터가 없으므로 8칸(예시) 기본값으로 반환. 서버 주간 통계가 생기면 대체하세요.
  const weeklyData: WeeklyItem[] = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({ day: String(i + 1).padStart(2, "0"), distance: 0 }));
  }, []);

  const totalDistance = useMemo(() => {
    // 임시: 상위 N명 합산. 원하는 정의에 맞게 교체 가능
    return rankingData.reduce((acc, cur) => acc + (Number(cur.distance) || 0), 0);
  }, [rankingData]);

  const percentChange = 0; // 전주 대비 데이터가 없으므로 0으로 표시

  return {
    loading,
    error,
    weeklyData,
    rankingData,
    totalDistance,
    percentChange,
  };
}
