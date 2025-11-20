// hooks/routes/useRouteDetail.ts
import { useEffect, useState } from 'react';
import { getRouteDetail, type RouteDetail, type RouteId } from '@utils/api/journeyRoutes';

export default function useRouteDetail(id: RouteId | undefined) {
  const [data, setData] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setError(new Error('invalid route id'));
      setLoading(false);
      return;
    }
    setLoading(true);
    getRouteDetail(id)
      .then((res) => {
        if (!mounted) return;
        // 필드가 없어도 화면이 안전하게 그려지도록 최소 기본값 부여
        const safe: RouteDetail = {
          id: res.id,
          title: res.title ?? '',
          description: res.description ?? '',
          distance: res.distance,
          duration: res.duration,
          difficulty: res.difficulty,
          completed: res.completed ?? 0,
          total: res.total ?? 0,
          image: res.image,
          tags: Array.isArray(res.tags) ? res.tags : [],
          landmarks: Array.isArray(res.landmarks) ? res.landmarks : [],
        } as any;
        setData(safe);
      })
      .catch((e) => mounted && setError(e as Error))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id]);

  return { data, loading, error } as const;
}
