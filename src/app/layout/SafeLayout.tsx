// components/common/SafeLayout.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  withBottomInset?: boolean; // 하단 여백 넣을지 옵션
  withTopInset?: boolean; // 상단 여백 넣을지 옵션
  style?: any;
};

export default function SafeLayout({
  children,
  withBottomInset = true,
  withTopInset = true,
  style,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        style,
        {
          paddingBottom: withBottomInset ? insets.bottom : 0,
          paddingTop: withTopInset ? insets.top : 0,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // 기본 배경
  },
});
