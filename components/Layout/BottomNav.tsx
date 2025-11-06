// BottomNavigation.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomBarHeight } from "./BottomBarHeightContext";
import { LinearGradient } from 'expo-linear-gradient';
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

// 네비게이션 아이템 타입
interface NavItem {
  key: string;
  label: string;
}

// Props 타입
interface BottomNavigationProps {
  activeTab: string;
  onTabPress: (tabKey: string) => void;
  isRunningScreen?: boolean;
}

// 네비게이션 아이템 데이터
const navItems: NavItem[] = [
  { key: "profile", label: "내정보" },
  { key: "crew", label: "크루" },
  { key: "running", label: "러닝" },
  { key: "feed", label: "피드" },
  { key: "record", label: "기록" },
];

export const BOTTOM_NAV_MIN_HEIGHT = 70; // 스크롤 하단 패딩 계산용(선택)

// ✅ 핵심: 절대 하단 고정 + SafeAreaView로 하단 노치 공간 확보
const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabPress,
  isRunningScreen = false,
}) => {
  const ACTIVE = "#000000";
  const { setHeight } = useBottomBarHeight();
  const insets = useSafeAreaInsets();

  // 안정적인 높이: 콘텐츠 고정 높이 + 하단 인셋
  React.useEffect(() => {
    const stable = Math.round(BOTTOM_NAV_MIN_HEIGHT + (insets.bottom || 0));
    setHeight(stable);
  }, [insets.bottom, setHeight]);

  return (
    <View pointerEvents="box-none" style={styles.absoluteBottom}>
      <SafeAreaView edges={["bottom"]} style={[
        styles.container,
        !isRunningScreen && styles.containerNormal
      ]}>
        <View style={[
          styles.floatingBar,
          isRunningScreen && styles.floatingBarRunning
        ]}>
          {navItems.map((item) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.navItem}
                onPress={() => onTabPress(item.key)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    active && { backgroundColor: ACTIVE },
                  ]}
                >
                  {item.key === "crew" ? (
                    <Feather
                      name="users"
                      size={24}
                      color={active ? "#ffffff" : "#4B5563"}
                    />
                  ) : item.key === "profile" ? (
                    <Feather
                      name="user"
                      size={24}
                      color={active ? "#ffffff" : "#4B5563"}
                    />
                  ) : item.key === "running" ? (
                    <MaterialCommunityIcons
                      name="run"
                      size={24}
                      color={active ? "#ffffff" : "#4B5563"}
                    />
                  ) : item.key === "feed" ? (
                    <Feather
                      name="list"
                      size={24}
                      color={active ? "#ffffff" : "#4B5563"}
                    />
                  ) : item.key === "record" ? (
                    <Feather
                      name="bar-chart-2"
                      size={24}
                      color={active ? "#ffffff" : "#4B5563"}
                    />
                  ) : null}
                </View>
                <Text style={[
                  styles.label,
                  active && { color: ACTIVE, fontWeight: "700" }
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    zIndex: 99,
  },
  container: {
    backgroundColor: "transparent",
  },
  containerNormal: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  floatingBar: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: "space-around",
    alignItems: "center",
    minHeight: BOTTOM_NAV_MIN_HEIGHT,
  },
  floatingBarRunning: {
    backgroundColor: "transparent",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: "transparent",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
});

export default BottomNavigation;
