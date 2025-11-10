// hooks/routes/useRouteList.ts
import { useEffect, useState } from 'react';
import { listRoutes, type RouteSummary } from '../../utils/api/journeyRoutes';
import { getMyProfile } from '../../utils/api/users';
import { listUserProgress } from '../../utils/api/userJourneys';

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
            return { ...r, userProgressPercent: percent, runningTogether } as any;
          });
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
