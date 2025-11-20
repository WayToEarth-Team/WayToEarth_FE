// App.tsx
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();
import React, { useEffect } from "react";
import { NativeModules, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
// safe-area not required here; keep padding minimal for tab bar only
import { navigationRef } from "@navigation/RootNavigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
} from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { RootStackParamList } from "@types/types";
import "./global.css";
import {
  registerForPushNotificationsAsync,
  sendTokenToServer,
  setupNotificationListeners,
  setupTokenRefreshListener,
} from "@utils/notifications";
import { WeatherProvider } from "@contexts/WeatherContext";
import { AuthProvider } from "@contexts/AuthContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@utils/queryClient";
import { setupReactQueryFocus } from "@utils/reactQueryFocus";

import Onboading from "@features/onboarding/screens/Onboading";
import OnboardingScreen from "@features/onboarding/screens/OnboardingScreen";
import Login from "@features/auth/screens/Login";
import Main from "@app/screens/Main";
import RunSummaryScreen from "@features/running/screens/RunSummaryscreen";
import LiveRunningScreen from "@features/running/screens/LiveRunningScreen";
import RunningStartScreen from "@features/running/screens/RunningStartScreen";
import RunningComplete from "@features/running/screens/RunningComplete";
import JourneyRouteListScreen from "@features/journey/screens/JourneyRouteListScreen";
import JourneyRouteDetailScreen from "@features/journey/screens/JourneyRouteDetailScreen";
import JourneyLoadingScreen from "@features/journey/screens/JourneyLoadingScreen";
import JourneyGuideScreen from "@features/journey/screens/JourneyGuideScreen";
import JourneyRunningScreen from "@features/journey/screens/JourneyRunningScreen";
import Feed from "@features/feed/screens/SendFeed";
import Feed2 from "@features/feed/screens/FeedScreen2";
import FeedDetail from "@features/feed/screens/FeedDetail";
import Profile from "@features/profile/screens/ProfileScreen";
import ProfileEdit from "@features/profile/screens/ProfileEditScreen";

import Emblem from "@features/profile/screens/EmblemCollectionScreen";
import Record from "@features/records/screens/RecordScreen";
import RecordDetailScreen from "@features/records/screens/RecordDetailScreen";
import AIFeedbackScreen from "@features/records/screens/AIFeedbackScreen";
import LoginSuccessScreen from "@features/auth/screens/LoginSuccessScreen";
import CrewScreen from "@features/crew/screens/CrewScreen";
import CrewDetailScreen from "@features/crew/screens/CrewDetailScreen";
import CrewEditScreen from "@features/crew/screens/CrewEditScreen";
import CrewRankingScreen from "@features/crew/screens/CrewRankingScreen";
import TabBarAdapter from "@app/layout/TabBarAdapter";
import LandmarkGuestbookScreen from "@features/guestbook/screens/LandmarkGuestbookScreen";
import MyGuestbookScreen from "@features/guestbook/screens/MyGuestbookScreen";
import GuestbookScreen from "@features/guestbook/screens/GuestbookScreen";
import LandmarkStoryScreen from "@features/landmark/screens/LandmarkStoryScreen";
import ChatScreen from "@features/crew/screens/ChatScreen";
import ScreenFade from "@app/layout/ScreenFade";
import { getApiBaseUrl } from "@utils/config/api";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// MainTabs: 하단 탭 네비게이터 (팀원 구조)
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBarAdapter {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="LiveRunningScreen"
        children={(props) => (
          <ScreenFade duration={340} scaleFrom={0.988} translateYFrom={10}>
            <LiveRunningScreen {...(props as any)} />
          </ScreenFade>
        )}
      />
      <Tab.Screen
        name="Feed"
        children={(props) => (
          <ScreenFade duration={340} scaleFrom={0.988} translateYFrom={10}>
            <Feed2 {...(props as any)} />
          </ScreenFade>
        )}
      />
      <Tab.Screen
        name="Record"
        children={(props) => (
          <ScreenFade duration={340} scaleFrom={0.988} translateYFrom={10}>
            <Record {...(props as any)} />
          </ScreenFade>
        )}
      />
      <Tab.Screen
        name="Crew"
        children={(props) => (
          <ScreenFade duration={340} scaleFrom={0.988} translateYFrom={10}>
            <CrewScreen {...(props as any)} />
          </ScreenFade>
        )}
      />
      <Tab.Screen
        name="Profile"
        children={(props) => (
          <ScreenFade duration={340} scaleFrom={0.988} translateYFrom={10}>
            <Profile {...(props as any)} />
          </ScreenFade>
        )}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // React Query가 RN 포커스를 인지하도록 설정(1회)
  setupReactQueryFocus();
  useEffect(() => {
    if (__DEV__) {
      // 개발 중에만 네이티브 모듈 점검 로그 표시
      console.log("===== NATIVE MODULES CHECK =====");
      console.log("All modules:", Object.keys(NativeModules));
      console.log("WayToEarthWear:", NativeModules.WayToEarthWear);
      if (NativeModules.WayToEarthWear) {
        console.log(
          "WayToEarthWear methods:",
          Object.keys(NativeModules.WayToEarthWear)
        );
      } else {
        console.error("❌ WayToEarthWear module NOT FOUND!");
      }
      console.log("================================");
      // 현재 API Base URL 로그 (dev에서 혼동 방지)
      try {
        console.log("API Base URL:", getApiBaseUrl());
      } catch {}
    }

    // Firebase FCM 토큰 등록 (Expo 서버 거치지 않음)
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        // 백엔드에 토큰 전송 (로그인 후에 호출하는 것이 더 좋음)
        // await sendTokenToServer(token);
      }
    })();

    // 알림 리스너 설정
    const cleanupListeners = setupNotificationListeners();

    // 토큰 갱신 리스너 설정
    const cleanupTokenRefresh = setupTokenRefreshListener();

    return () => {
      cleanupListeners();
      cleanupTokenRefresh();
    };
  }, []);

  // 알림 탭 등으로 저장된 보류 네비게이션 처리
  const handleNavReady = async () => {
    try {
      const raw = await AsyncStorage.getItem("@pending_nav");
      if (raw) {
        const { target, params } = JSON.parse(raw);
        AsyncStorage.removeItem("@pending_nav").catch(() => {});
        // target은 'live' | 'journey'
        if (target === "journey") {
          (navigationRef as any).navigate("JourneyRunningScreen", params || {});
        } else {
          (navigationRef as any).navigate("MainTabs", {
            screen: "LiveRunningScreen",
            ...(params || {}),
          });
        }
      }
    } catch {}
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WeatherProvider>
          <SafeAreaProvider>
            <NavigationContainer ref={navigationRef} onReady={handleNavReady}>
            <Stack.Navigator
              initialRouteName={"Onboading"}
              screenOptions={{
                headerShown: false,
                // 부드러운 페이지 전환 애니메이션
                gestureEnabled: true,
                gestureDirection: "horizontal",
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                animationEnabled: true,
                animationTypeForReplace: "pop",
                transitionSpec: {
                  open: TransitionSpecs.TransitionIOSSpec,
                  close: TransitionSpecs.TransitionIOSSpec,
                },
              }}
            >
              <Stack.Screen name="Onboading" component={Onboading} />
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="Register" component={OnboardingScreen} />
              <Stack.Screen
                name="LoginSuccess"
                component={LoginSuccessScreen}
              />
              <Stack.Screen name="Main" component={Main} />
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="LiveRunning" component={LiveRunningScreen} />

              {/* 여정 러닝: 로딩/가이드/리스트/디테일/실행 */}
              <Stack.Screen
                name="JourneyLoading"
                component={JourneyLoadingScreen}
              />
              <Stack.Screen
                name="JourneyGuide"
                component={JourneyGuideScreen}
              />
              <Stack.Screen
                name="JourneyRouteList"
                component={JourneyRouteListScreen}
              />
              <Stack.Screen
                name="JourneyRouteDetail"
                component={JourneyRouteDetailScreen}
              />
              <Stack.Screen
                name="JourneyRunningScreen"
                component={JourneyRunningScreen}
              />
              <Stack.Screen
                name="RunningComplete"
                component={RunningComplete}
              />
              <Stack.Screen
                name="RunSummary"
                component={RunSummaryScreen}
                options={{ headerShown: false }}
              />

              {/* Feed/Profile/Record/Crew/LiveRunningScreen는 MainTabs로 이동 */}
              <Stack.Screen name="FeedDetail" component={FeedDetail} />
              {/* Crew Chat Screen */}
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="CrewChat" component={ChatScreen} />
              {/* 공유 작성 화면(FeedCompose) 등록: RunSummary에서 사용 */}
              <Stack.Screen
                name="FeedCompose"
                component={Feed}
                options={{ title: "공유하기" }}
              />
              <Stack.Screen name="Emblem" component={Emblem} />
              <Stack.Screen name="ProfileEdit" component={ProfileEdit} />
              <Stack.Screen name="CrewDetail" component={CrewDetailScreen} />
              <Stack.Screen name="CrewEdit" component={CrewEditScreen} />
              <Stack.Screen name="CrewRanking" component={CrewRankingScreen as any} />

              {/* 하단 탭 대상 라우트들은 MainTabs 내부 */}
              <Stack.Screen
                name="RecordDetailScreen"
                component={RecordDetailScreen}
              />
              <Stack.Screen
                name="AIFeedbackScreen"
                component={AIFeedbackScreen as any}
              />

              {/* 방명록 화면들 */}
              <Stack.Screen
                name="GuestbookScreen"
                component={GuestbookScreen}
                options={{ title: "방명록 피드" }}
              />
              <Stack.Screen
                name="LandmarkGuestbookScreen"
                component={LandmarkGuestbookScreen as any}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="MyGuestbookScreen"
                component={MyGuestbookScreen}
                options={{ headerShown: false }}
              />

              {/* 랜드마크 스토리 화면 */}
              <Stack.Screen
                name="LandmarkStoryScreen"
                component={LandmarkStoryScreen as any}
                options={{ headerShown: false }}
              />
            </Stack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
        </WeatherProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
