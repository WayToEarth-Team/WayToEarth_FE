// components/Running/WeatherModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import type { WeatherData } from "@contexts/WeatherContext";

interface WeatherModalProps {
  visible: boolean;
  onClose: () => void;
  weather: WeatherData | null;
}

export default function WeatherModal({
  visible,
  onClose,
  weather,
}: WeatherModalProps) {
  if (!weather) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* 날씨 이모지 */}
          <Text style={styles.emoji}>{weather.emoji}</Text>

          {/* 날씨 컨디션 */}
          <Text style={styles.condition}>{weather.condition}</Text>

          {/* 추천 메시지 */}
          <Text style={styles.recommendation}>{weather.recommendation}</Text>

          {/* 조회 시각 */}
          <Text style={styles.timestamp}>
            {new Date(weather.fetchedAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            업데이트
          </Text>

          {/* 닫기 버튼 */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Text style={styles.closeButtonText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    width: "85%",
    maxWidth: 320,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    ...Platform.select({
      ios: {
        backdropFilter: "blur(10px)",
      },
    }),
  },
  emoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  condition: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: "center",
  },
  closeButtonPressed: {
    backgroundColor: "#2563EB",
    transform: [{ scale: 0.98 }],
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
