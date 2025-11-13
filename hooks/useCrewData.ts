import { useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Crew } from "../utils/api/crews";
import { getMyCrew, listCrews, createCrew, joinCrew, type JoinResult, getCrewById } from "../utils/api/crews";
import { getTopCrewsByDistance } from "../utils/api/crewStats";
import type { TopCrewItemData } from "../types/Crew";
// Top crew mock data removed. If server provides a ranking API,
// fetch and map it here; otherwise leave empty for now.

export function useCrewData(searchText: string) {
  const [myCrew, setMyCrew] = useState<Crew | null>(null);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PENDING_KEY = "crew.pending.join.ids";
  const [pendingJoins, setPendingJoins] = useState<Set<string>>(new Set());

  // load pending join ids from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = (await AsyncStorage.getItem(PENDING_KEY)) || "[]";
        const arr = JSON.parse(raw) as string[];
        setPendingJoins(new Set((arr || []).map(String)));
      } catch {}
    })();
  }, []);

  const persistPending = useCallback(async (setIds: Set<string>) => {
    try {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(Array.from(setIds)));
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrentPage(0);
    setHasMore(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      // 각 호출을 독립적으로 보호
      const mPromise = getMyCrew().catch(() => null);
      const listPromise = listCrews(searchText, 0, 20).catch(() => ({ crews: [] as Crew[], hasMore: false }));
      const topPromise = getTopCrewsByDistance({ month, limit: 3 }).catch(() => []);
      const [m, listResult, top] = await Promise.all([mPromise, listPromise, topPromise]);
      const list = listResult.crews;
      setMyCrew(m ?? null);
      // 가입이 승인되어 내 크루가 생겼다면 대기중 목록 초기화
      if (m) {
        const cleared = new Set<string>();
        setPendingJoins(cleared);
        persistPending(cleared);
      }
      // 상단 랭킹 + 프로필 이미지 채우기: 목록 매칭 -> ID 상세 -> 이름 검색 순서
      if (top && top.length) {
        // 1) 현재 목록에서 id 매칭으로 빠르게 채우기
        const listMap = new Map<string, string | null>();
        (list || []).forEach((c: any) => listMap.set(String(c.id), c.imageUrl ?? null));
        let enriched = top.map((t) => ({
          ...t,
          imageUrl: listMap.get(String(t.id)) ?? null,
        }));

        // 2) 이미지 없는 항목은 ID로 상세 조회해 보강 (요구사항: crewId로 이미지 조회)
        const needById = enriched
          .map((t, idx) => ({ t, idx }))
          .filter(({ t }) => !t.imageUrl);
        if (needById.length > 0) {
          const results = await Promise.allSettled(
            needById.map(({ t }) => getCrewById(String(t.id)))
          );
          results.forEach((res, i) => {
            const { idx } = needById[i];
            if (res.status === "fulfilled") {
              enriched[idx] = {
                ...enriched[idx],
                imageUrl: (res.value as any)?.profileImageUrl ?? enriched[idx].imageUrl ?? null,
              };
            }
          });
        }

        // 3) 그래도 비어있으면 이름 검색으로 보강 (fallback)
        const needByName = enriched
          .map((t, idx) => ({ t, idx }))
          .filter(({ t }) => !t.imageUrl);
        if (needByName.length > 0) {
          try {
            const searched = await Promise.all(
              needByName.map(({ t }) => listCrews(String(t.name)).catch(() => [] as any[]))
            );
            needByName.forEach(({ t, idx }, i) => {
              const arr = searched[i] as any[];
              const hit = (arr || []).find((c) => String(c.id) === String(t.id));
              if (hit && (hit as any).imageUrl) {
                enriched[idx] = { ...enriched[idx], imageUrl: (hit as any).imageUrl };
              }
            });
          } catch {}
        }
        setTopCrews(enriched);
      } else {
        setTopCrews([]);
      }
      // 내 크루가 목록에 있으면 중복 제거 (id 타입 차이 방지용 String 비교)
      const myId = m ? String((m as any).id) : "";
      const filtered = (list ?? []).filter((c) => String((c as any).id) !== myId);
      setCrews(filtered);
      setHasMore(listResult.hasMore);
    } catch (e: any) {
      setError(e?.message || "크루 정보를 불러오지 못했습니다.");
      // 오류 시 이전 myCrew가 남아 빈 상태 표시가 안되는 문제 방지
      setMyCrew(null);
      // 리스트는 최소한 비워서 UI 진행
      setCrews([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const result = await listCrews(searchText, nextPage, 20);

      // 내 크루 제외 필터링
      const myId = myCrew ? String((myCrew as any).id) : "";
      const filtered = result.crews.filter((c) => String((c as any).id) !== myId);

      setCrews((prev) => [...prev, ...filtered]);
      setCurrentPage(nextPage);
      setHasMore(result.hasMore);
    } catch (e: any) {
      console.error("Failed to load more crews:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, searchText, myCrew]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [topCrews, setTopCrews] = useState<TopCrewItemData[]>([]);

  // 화면에서는 내 크루를 별도로 노출하므로,
  // 목록(crews)에는 항상 내 크루를 제외한 항목만 유지
  const finalList = useMemo(() => {
    if (!myCrew) return crews;
    const myId = String((myCrew as any).id);
    return (crews || []).filter((c) => String((c as any).id) !== myId);
  }, [myCrew, crews]);

  const ensureMyCrew = useCallback(async () => {
    const created = await createCrew({ name: "내 크루", description: "함께 달려요" });
    setMyCrew(created);
  }, []);

  const createMyCrew = useCallback(async (name: string, description?: string) => {
    const created = await createCrew({ name, description });
    setMyCrew(created);
    // 목록에서 중복 제거
    setCrews((prev) => prev.filter((c) => String((c as any).id) !== String((created as any).id)));
    return created;
  }, []);

  const joinExistingCrew = useCallback(async (crew: Crew, message?: string) => {
    const id = String((crew as any).id);
    if (pendingJoins.has(id)) {
      const err = new Error("이미 해당 크루에 가입 신청이 접수되어 있습니다. 승인 또는 거절될 때까지 기다려주세요.");
      (err as any).code = "JOIN_PENDING_EXISTS";
      throw err;
    }
    const res: JoinResult = await joinCrew(crew, message);
    if ((res as any)?.pending) {
      // 승인 대기: 내 크루는 그대로 null 유지
      const next = new Set(pendingJoins);
      next.add(id);
      setPendingJoins(next);
      persistPending(next);
      return res;
    }
    const joined = res as Crew;
    setMyCrew(joined);
    setCrews((prev) => prev.filter((c) => String((c as any).id) !== String((joined as any).id)));
    // 승인 즉시 가입이 된다면 pending 목록 비움
    const cleared = new Set<string>();
    setPendingJoins(cleared);
    persistPending(cleared);
    return joined;
  }, [pendingJoins, persistPending]);

  return {
    topCrews,
    crews: finalList,
    myCrew,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    ensureMyCrew,
    createMyCrew,
    joinExistingCrew,
  };
}
