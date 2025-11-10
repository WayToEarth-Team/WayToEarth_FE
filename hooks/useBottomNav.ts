import { useCallback, useEffect, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

export type TabKey = "profile" | "crew" | "running" | "feed" | "record";

const TAB_TO_ROUTE: Record<TabKey, string> = {
  profile: "Profile",
  // Crew 탭을 누르면 크루 메인으로 이동하도록 수정
  crew: "Crew",
  // 러닝 탭은 실제 러닝 화면으로 이동
  running: "LiveRunningScreen",
  feed: "Feed",
  record: "Record",
};

// 라우트 → 탭 역매핑
const ROUTE_TO_TAB = Object.fromEntries(
  (Object.keys(TAB_TO_ROUTE) as TabKey[]).map((k) => [TAB_TO_ROUTE[k], k])
) as Record<string, TabKey>;

export function useBottomNav(defaultTab: TabKey = "running") {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  // MainTabs 하위 탭 스크린 목록에 'Crew' 추가
  const TAB_ROUTES = new Set(["LiveRunningScreen", "Feed", "Record", "Profile", "Crew"]);

  // 현재 라우트가 바뀌면 activeTab 동기화
  useEffect(() => {
    const tab = ROUTE_TO_TAB[route.name];
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [route.name]);

  const onTabPress = useCallback(
    (tabKey: string) => {
      const key = tabKey as TabKey;
      const target = TAB_TO_ROUTE[key];
      // 디버그 로그: 탭 클릭 → 이동 대상
      try {
        console.log("[BottomNav] press", { from: route.name, tabKey: key, target });
      } catch {}
      if (!target) return;

      setActiveTab(key);
      try {
        if (TAB_ROUTES.has(target)) {
          // 탭 대상은 MainTabs 하위로 이동
          navigation.navigate('MainTabs' as never, { screen: target } as never);
        } else {
          navigation.navigate(target as never);
        }
      } catch (e) {
        console.warn("[BottomNav] navigate failed", { target, error: (e as any)?.message });
      }
    },
    [navigation, route.name]
  );

  return { activeTab, onTabPress };
}
