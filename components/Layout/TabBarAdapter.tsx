import React, { useEffect, useState } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import BottomNavigation from "./BottomNav";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const ROUTE_TO_KEY: Record<string, string> = {
  Profile: "profile",
  ChatScreen: "crew",
  LiveRunningScreen: "running",
  Feed: "feed",
  Record: "record",
};

const KEY_TO_ROUTE: Record<string, string> = {
  profile: "Profile",
  crew: "ChatScreen",
  running: "LiveRunningScreen",
  feed: "Feed",
  record: "Record",
};

export default function TabBarAdapter({
  state,
  navigation,
}: BottomTabBarProps) {
  const route = state.routes[state.index];
  const activeTab = ROUTE_TO_KEY[route.name] || "running";

  const [hidden, setHidden] = useState(false);

  // Hide when a running session is active
  const refreshHidden = async () => {
    try {
      const raw = await AsyncStorage.getItem("@running_session");
      if (raw) {
        const s = JSON.parse(raw);
        setHidden(!!s?.isRunning);
      } else {
        setHidden(false);
      }
    } catch {
      setHidden(false);
    }
  };

  useEffect(() => {
    refreshHidden();
    const sub = AppState.addEventListener("change", () => refreshHidden());

    // 화면 포커스 시에도 체크 (러닝 종료 후 다른 탭으로 이동 시)
    const unsubscribeFocus = navigation.addListener("state", () => {
      refreshHidden();
    });

    return () => {
      sub.remove();
      unsubscribeFocus();
    };
  }, [route?.name, navigation]);

  const onTabPress = (key: string) => {
    const target = KEY_TO_ROUTE[key];
    if (!target) return;
    if (target === 'ChatScreen') {
      const parent = (navigation as any).getParent?.();
      if (parent && typeof parent.navigate === 'function') {
        parent.navigate('ChatScreen' as never);
      } else {
        navigation.navigate('ChatScreen' as never);
      }
      return;
    }
    navigation.navigate(target as never);
  };

  if (hidden) return null;
  return <BottomNavigation activeTab={activeTab} onTabPress={onTabPress} />;
}
