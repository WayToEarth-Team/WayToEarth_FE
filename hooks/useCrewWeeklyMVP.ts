import { useEffect, useMemo, useState } from "react";
import { getCrewWeeklyCompare, getCrewWeeklyDaily } from "@utils/api/crewStats";
import { getAllCrewMembers } from "@utils/api/crews";

export type WeeklyItem = { label: string; thisWeek: number; lastWeek: number; name?: string };
export type RankingItem = { rank: number; name: string; thisWeek: number; lastWeek: number; isUser?: boolean; imageUrl?: string | null; userId?: number };

export function useCrewWeeklyMVP(crewId: string, opts?: { month?: string; limit?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyCompare, setWeeklyCompare] = useState<{ members: RankingItem[]; thisWeekTotal: number; lastWeekTotal: number; growthRate: number | null; days?: WeeklyItem[] } | null>(null);

  const month = useMemo(() => {
    if (opts?.month) return opts.month;
    const d = new Date();
    // 이번 주 월요일(Asia/Seoul 기준 가정)을 YYYY-MM-DD 문자열로 산출
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMon);
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  useEffect(() => {
    if (!crewId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let compareRes: any = null;
        let dailyRes: any = null;
        let crewMembers: any[] = [];
        [compareRes, dailyRes, crewMembers] = await Promise.all([
          getCrewWeeklyCompare(crewId, { weekStart: month, limit: opts?.limit ?? 8 }).catch(() => null),
          getCrewWeeklyDaily(crewId, { weekStart: month }).catch(() => null),
          getAllCrewMembers(crewId).catch(() => []),
        ]);
        if (!alive) return;
        const imageMap = new Map<string, string | null>();
        (crewMembers as any[]).forEach((m: any) => {
          const key = String(m?.id ?? m?.userId ?? "");
          const img = m?.profileImage ?? m?.profile_image_url ?? m?.profileImageUrl ?? m?.imageUrl ?? null;
          if (key) imageMap.set(key, img ?? null);
        });
        const members = (compareRes as any)?.members?.map((m: any) => ({
          rank: m.rank,
          name: m.name,
          thisWeek: parseDistance(m.thisWeek),
          lastWeek: parseDistance(m.lastWeek),
          isUser: false,
          userId: m.userId,
          imageUrl:
            (m as any).imageUrl ??
            (m as any).profileImageUrl ??
            (m as any).profile_image_url ??
            imageMap.get(String((m as any).userId)) ??
            null,
        })) ?? [];
        const daysOrdered = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
        const daysMap = new Map<string, any>();
        (dailyRes?.days ?? []).forEach((d: any) => {
          daysMap.set(String(d?.dow ?? ""), d);
        });
        const weeklyDataDays = daysOrdered.map((dow) => {
          const d = daysMap.get(dow) || {};
          return {
            label: dowLabel(dow),
            thisWeek: parseDistance(d?.thisWeekDistance),
            lastWeek: parseDistance(d?.lastWeekDistance),
          };
        });
        const thisWeekTotal = Number(
          (compareRes as any)?.thisWeekTotal ?? (compareRes as any)?.crew?.thisWeekTotal ?? dailyRes?.thisWeekTotal
        ) || 0;
        const lastWeekTotal = Number(
          (compareRes as any)?.lastWeekTotal ?? (compareRes as any)?.crew?.lastWeekTotal ?? dailyRes?.lastWeekTotal
        ) || 0;
        const growthRate = (compareRes as any)?.growthRate ?? (compareRes as any)?.crew?.growthRate ?? dailyRes?.growthRate ?? null;

        setWeeklyCompare({
          members,
          thisWeekTotal,
          lastWeekTotal,
          growthRate,
          days: weeklyDataDays,
        });
      } catch (e: any) {
        if (!alive) return;
        const msg = e?.response?.data?.message || e?.message || "MVP 데이터를 불러오지 못했습니다.";
        setError(msg);
        setWeeklyCompare(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [crewId, month, opts?.limit]);

  const rankingData: RankingItem[] = useMemo(() => {
    if (!weeklyCompare) return [];
    return weeklyCompare.members.map((m: any) => ({
      rank: m.rank,
      name: m.name,
      thisWeek: m.thisWeek,
      lastWeek: m.lastWeek,
      isUser: m.isUser,
      imageUrl: m.imageUrl ?? m._imageUrl ?? null,
      userId: m.userId,
    }));
  }, [weeklyCompare]);

  const weeklyData: WeeklyItem[] = useMemo(() => {
    const source = weeklyCompare?.days as WeeklyItem[] | undefined;
    if (source && source.length) return source;
    return Array.from({ length: 7 }).map((_, i) => ({
      label: dowLabel(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"][i]),
      thisWeek: 0,
      lastWeek: 0,
    }));
  }, [weeklyCompare]);

  const totalDistance = useMemo(() => weeklyCompare?.thisWeekTotal ?? 0, [weeklyCompare]);
  const lastWeekTotal = useMemo(() => weeklyCompare?.lastWeekTotal ?? 0, [weeklyCompare]);

  const percentChange = useMemo<number | null>(() => {
    if (!weeklyCompare) return 0;
    const last = weeklyCompare.lastWeekTotal || 0;
    const cur = weeklyCompare.thisWeekTotal || 0;
    if (last === 0 && cur === 0) return 0;
    if (last === 0) return Infinity; // 지난주 0에서 이번주 달성 -> 신규
    return ((cur - last) / last) * 100;
  }, [weeklyCompare]);

  return {
    loading,
    error,
    weeklyData,
    rankingData,
    totalDistance,
    lastWeekTotal,
    percentChange,
  };
}

function dowLabel(dow: string) {
  switch (dow) {
    case "MONDAY":
      return "월";
    case "TUESDAY":
      return "화";
    case "WEDNESDAY":
      return "수";
    case "THURSDAY":
      return "목";
    case "FRIDAY":
      return "금";
    case "SATURDAY":
      return "토";
    case "SUNDAY":
      return "일";
    default:
      return dow?.slice?.(0, 1) || "";
  }
}

function parseDistance(value: any): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
