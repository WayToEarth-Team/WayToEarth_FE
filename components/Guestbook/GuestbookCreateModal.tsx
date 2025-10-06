// components/Guestbook/GuestbookCreateModal.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  createGuestbook,
  validateGuestbookMessage,
  getGuestbookErrorMessage,
} from "../../utils/api/guestbook";
import type { LandmarkSummary } from "../../types/guestbook";

interface GuestbookCreateModalProps {
  visible: boolean;
  onClose: () => void;
  landmark: LandmarkSummary;
  userId: number;
  onSuccess?: () => void;
}

/**
 * 방명록 작성 모달
 * - 메시지 입력 (500자 제한)
 * - 글자 수 카운터
 * - 공개/비공개 토글
 */
export default function GuestbookCreateModal({
  visible,
  onClose,
  landmark,
  userId,
  onSuccess,
}: GuestbookCreateModalProps) {
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // 클라이언트 유효성 검사
    const error = validateGuestbookMessage(message);
    if (error) {
      Alert.alert("입력 오류", error);
      return;
    }

    setLoading(true);

    try {
      await createGuestbook(userId, {
        landmarkId: landmark.id,
        message: message.trim(),
        isPublic,
      });

      Alert.alert("성공", "방명록이 작성되었습니다!");
      setMessage("");
      setIsPublic(true);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("[GuestbookCreate] 작성 실패:", err);
      const errorMessage = getGuestbookErrorMessage(err);
      Alert.alert("작성 실패", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (message.trim().length > 0) {
      Alert.alert(
        "작성 취소",
        "작성 중인 내용이 있습니다. 정말 취소하시겠습니까?",
        [
          { text: "계속 작성", style: "cancel" },
          {
            text: "취소",
            style: "destructive",
            onPress: () => {
              setMessage("");
              setIsPublic(true);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > 500;
  const isEmpty = message.trim().length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <Text style={styles.cancelButton}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>방명록 작성</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || isEmpty || isOverLimit}
            >
              <Text
                style={[
                  styles.submitButton,
                  (loading || isEmpty || isOverLimit) &&
                    styles.submitButtonDisabled,
                ]}
              >
                {loading ? "작성 중..." : "완료"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* 랜드마크 정보 */}
            <View style={styles.landmarkInfo}>
              <Text style={styles.landmarkIcon}>📍</Text>
              <View style={styles.landmarkDetails}>
                <Text style={styles.landmarkName}>{landmark.name}</Text>
                <Text style={styles.landmarkLocation}>
                  {landmark.cityName}, {landmark.countryCode}
                </Text>
              </View>
            </View>

            {/* 메시지 입력 */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="이 장소에 대한 소감을 남겨주세요..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={550} // 약간 여유있게
                autoFocus
                editable={!loading}
              />

              {/* 글자 수 카운터 */}
              <View style={styles.charCounter}>
                <Text
                  style={[
                    styles.charCountText,
                    isOverLimit && styles.charCountOverLimit,
                  ]}
                >
                  {charCount}/500
                </Text>
              </View>
            </View>

            {/* 공개/비공개 토글 */}
            <View style={styles.toggleContainer}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>공개 방명록</Text>
                <Text style={styles.toggleDescription}>
                  {isPublic
                    ? "다른 사용자도 이 방명록을 볼 수 있습니다"
                    : "나만 볼 수 있는 방명록입니다"}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                disabled={loading}
                trackColor={{ false: "#d1d5db", true: "#000" }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  cancelButton: {
    fontSize: 16,
    color: "#6b7280",
  },
  submitButton: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  submitButtonDisabled: {
    color: "#d1d5db",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  landmarkInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  landmarkIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  landmarkDetails: {
    flex: 1,
  },
  landmarkName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  landmarkLocation: {
    fontSize: 14,
    color: "#6b7280",
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    fontSize: 16,
    color: "#000",
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: "top",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  charCounter: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  charCountText: {
    fontSize: 14,
    color: "#6b7280",
  },
  charCountOverLimit: {
    color: "#ef4444",
    fontWeight: "600",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
});
