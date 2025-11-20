// hooks/routes/useRouteList.ts
import { useEffect, useState } from 'react';
import { listRoutes, type RouteSummary } from '@utils/api/journeyRoutes';
import { getMyProfile } from '@utils/api/users';
import { listUserProgress, getState as getJourneyState } from '@utils/api/userJourneys';

export default function useRouteList(category?: "DOMESTIC" | "INTERNATIONAL") {
  const [data, setData] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const routes = await listRoutes(category);
        if (!mounted) return;
        // 사용자 진행률을 병합
        let enriched = routes;
        try {
          const me = await getMyProfile();
          const progressList = await listUserProgress(String(me.id));
          const percentMap = new Map<number, number>();
          const progressMMap = new Map<number, number>();
          const runningTogetherMap = new Map<number, number>();
          progressList.forEach((p) => {
            percentMap.set(Number(p.journeyId), Number(p.percent) || 0);
            progressMMap.set(Number(p.journeyId), Number(p.progressM) || 0);
            runningTogetherMap.set(Number(p.journeyId), Number(p.runningTogether) || 0);
          });
          enriched = routes.map((r) => {
            const jid = Number(r.id);
            let percent = percentMap.get(jid);
            if (percent == null || !Number.isFinite(percent)) {
              // fallback: compute from progressM and total distance if available
              const progressM = progressMMap.get(jid) ?? 0;
              const totalKm = Number(String(r.distance || '').replace(/[^\d.]/g, '')) || 0;
              const totalM = totalKm * 1000;
              percent = totalM > 0 ? (progressM / totalM) * 100 : 0;
            }
            const runningTogether = runningTogetherMap.get(jid) ?? r.runningTogether ?? 0;
            // 정규화(0~100) 및 반올림은 표시 단계에서 하지만 여기서도 최소한 보정
            const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, Number(percent))) : 0;
            return { ...r, userProgressPercent: safePercent, runningTogether } as any;
          });

          // 2차 보정: 여전히 0%로 남아있는 항목에 한해서 정확한 진행률 단건 조회(getState)
          // 서버 상태에 따라 목록 API가 퍼센트를 주지 않는 경우 보완
          const needFix = enriched.filter((r: any) => !Number.isFinite(r.userProgressPercent) || Number(r.userProgressPercent) === 0);
          if (needFix.length > 0) {
            const fixed = await Promise.all(
              needFix.map(async (r: any) => {
                try {
                  const totalKm = Number(String(r.distance || '').replace(/[^\d.]/g, '')) || 0;
                  const totalM = Math.max(0, totalKm * 1000);
                  if (!totalM) return { id: r.id, percent: 0 };
                  const s = await getJourneyState(String(me.id), String(r.id), totalM, 0);
                  const p = Number.isFinite(s.percent) ? Math.max(0, Math.min(100, Number(s.percent))) : 0;
                  return { id: r.id, percent: p };
                } catch {
                  return { id: r.id, percent: 0 };
                }
              })
            );
            const fixMap = new Map<string | number, number>(fixed.map((x) => [x.id, x.percent]));
            enriched = enriched.map((r: any) => {
              const fp = fixMap.get(r.id);
              return fp != null && (r.userProgressPercent == null || r.userProgressPercent === 0)
                ? { ...r, userProgressPercent: fp }
                : r;
            });
          }
        } catch {
          // 진행률 병합 실패 시 리스트만 표시
        }
        setData(Array.isArray(enriched) ? enriched : []);
      } catch (e) {
        if (mounted) setError(e as Error);
      } finally {
        if (mounted) setLoading(false);
      }
    })()
      .catch((e) => mounted && setError(e as Error))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [category]);

  return { data, loading, error } as const;
}
