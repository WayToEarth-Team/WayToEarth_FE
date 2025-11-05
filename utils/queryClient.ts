import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 날씨 등 저빈도 데이터 기본값(개별 훅에서 재지정 가능)
      staleTime: 30 * 60 * 1000, // 30분간 신선
      gcTime: 30 * 60 * 1000, // 30분간 캐시 유지
      retry: 2, // 네트워크/일시 오류 재시도 소폭
      refetchOnReconnect: true,
      refetchOnWindowFocus: true, // RN에서는 focusManager 연동 필요
    },
  },
});

