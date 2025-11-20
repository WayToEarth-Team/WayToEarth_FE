import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  navigation: any;
  showBack?: boolean;
  onBack?: () => void;
  backgroundColor?: string;
  borderBottomColor?: string;
  tintColor?: string; // 아이콘 색상
  titleStyle?: TextStyle;
  containerStyle?: ViewStyle;
};

export default function AppTopBar({
  title,
  navigation,
  showBack,
  onBack,
  backgroundColor = "#FFFFFF",
  borderBottomColor = "#F3F4F6",
  tintColor = "#111827",
  titleStyle,
  containerStyle,
}: Props) {
  const canGoBack =
    typeof showBack === "boolean" ? showBack : !!navigation?.canGoBack?.();

  const handleBack = () => {
    if (onBack) return onBack();
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor }}>
      <View
        style={[
          styles.container,
          { paddingTop: 12, backgroundColor, borderBottomColor },
          containerStyle,
        ]}
      >
        {canGoBack ? (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={tintColor} />
          </Pressable>
        ) : (
          <View style={{ width: 24, height: 24, marginRight: 8 }} />
        )}
        <Text style={[styles.title, { color: tintColor }, titleStyle]}>
          {title}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
});
