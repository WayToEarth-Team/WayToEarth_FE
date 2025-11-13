import React, { useEffect, useState } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import BottomNavigation from "./BottomNav";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { addRunningSessionListener } from "../../utils/navEvents";
import { useBottomBarHeight } from "./BottomBarHeightContext";

const ROUTE_TO_KEY: Record<string, string> = {
  Profile: "profile",
  Crew: "crew",
  LiveRunningScreen: "running",
  Feed: "feed",
  Record: "record",
};

const KEY_TO_ROUTE: Record<string, string> = {
  profile: "Profile",
  crew: "Crew",
  running: "LiveRunningScreen",
  feed: "Feed",
  record: "Record",
};

export default function TabBarAdapter({
  state,
  navigation,
}: BottomTabBarProps) {
  const { setHeight } = useBottomBarHeight();
  const route = state.routes[state.index];
  const activeTab = ROUTE_TO_KEY[route.name] || "running";

  const [hidden, setHidden] = useState(false);
  const [locked, setLocked] = useState(false);

  // Hide when a running session is active
  const refreshHidden = async () => {
    try {
      const raw = await AsyncStorage.getItem("@running_session");
      if (raw) {
        const s = JSON.parse(raw);
        // 탭바 숨김은 러닝 화면에서만 적용
        const isRunning = !!s?.isRunning;
        // 러닝 중엔 어떤 화면에서도 탭바 숨김
        setHidden(isRunning);
        setLocked(isRunning);
      } else {
        setHidden(false);
        setLocked(false);
      }
    } catch {
      setHidden(false);
      setLocked(false);
    }
  };

  useEffect(() => {
    refreshHidden();
    const sub = AppState.addEventListener("change", () => refreshHidden());
    const evt = addRunningSessionListener((isRunning) => {
      setHidden(isRunning);
      setLocked(isRunning);
    });

    return () => {
      sub.remove();
      try { evt.remove(); } catch {}
    };
  }, [route?.name, navigation]);

  // 탭바가 숨김일 때는 높이를 0으로 반영
  useEffect(() => {
    if (hidden) setHeight(0);
  }, [hidden, setHeight]);

  const onTabPress = (key: string) => {
    // 러닝 중에는 러닝 탭 외 이동 차단
    if (locked && key !== 'running') return;
    const target = KEY_TO_ROUTE[key];
    if (!target) return;
    navigation.navigate(target as never);
  };

  if (hidden) return null;
  return <BottomNavigation activeTab={activeTab} onTabPress={onTabPress} isRunningScreen={route.name === 'LiveRunningScreen'} />;
}
