import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  navigation: any;
  showBack?: boolean;
  onBack?: () => void;
};

export default function AppTopBar({
  title,
  navigation,
  showBack,
  onBack,
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
    <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
    <View style={[styles.container, { paddingTop: 12 }]}>
      {canGoBack ? (
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
      ) : (
        <View style={{ width: 24, height: 24, marginRight: 8 }} />
      )}
      <Text style={styles.title}>{title}</Text>
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
