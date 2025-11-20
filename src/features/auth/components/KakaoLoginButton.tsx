// src/features/auth/components/KakaoLoginButton.tsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
// import KakaoLogo from "@features/auth/assets/kakao-talk-communication.svg";

export default function KakaoLoginButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.kakaoButton} onPress={onPress}>
      {/* <KakaoLogo width={20} height={20} /> */}
      <Text style={styles.kakaoButtonText}>카카오 계정으로 계속하기</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  kakaoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE500",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  kakaoButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3C1E1E",
  },
});
