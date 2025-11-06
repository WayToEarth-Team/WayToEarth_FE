import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.85;

interface CrewPreviewDrawerProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  description?: string;
  progress?: string;
  onJoin?: (intro: string) => Promise<void>;
}

export default function CrewPreviewDrawer({
  visible,
  onClose,
  name,
  description,
  progress,
  onJoin,
}: CrewPreviewDrawerProps) {
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(DRAWER_WIDTH));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleJoin = async () => {
    if (!intro.trim() || !onJoin) return;
    setLoading(true);
    try {
      await onJoin(intro);
      setIntro("");
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIntro("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            s.drawer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 헤더 */}
              <View style={s.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={s.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <View style={s.crewImageContainer}>
                  <View style={s.crewImagePlaceholder}>
                    <Ionicons name="people" size={48} color="#6366F1" />
                  </View>
                </View>

                <Text style={s.crewName}>{name}</Text>
                {progress && (
                  <View style={s.progressBadge}>
                    <Ionicons name="footsteps" size={14} color="#6366F1" />
                    <Text style={s.progressText}>{progress}</Text>
                  </View>
                )}
              </View>

              {/* 크루 정보 */}
              <View style={s.content}>
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#6366F1"
                    />
                    <Text style={s.sectionTitle}>크루 소개</Text>
                  </View>
                  <Text style={s.description}>
                    {description || "크루 소개가 없습니다."}
                  </Text>
                </View>

                <View style={s.divider} />

                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Ionicons name="create" size={20} color="#6366F1" />
                    <Text style={s.sectionTitle}>가입 신청</Text>
                  </View>
                  <Text style={s.label}>
                    자기소개 <Text style={s.required}>*</Text>
                  </Text>
                  <View style={s.inputWrapper}>
                    <TextInput
                      style={s.textarea}
                      value={intro}
                      onChangeText={setIntro}
                      placeholder="크루장에게 자기소개를 남겨주세요&#10;(예: 안녕하세요! 매일 아침 5km 뛰고 있습니다. 함께 하고 싶어요!)"
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={6}
                      maxLength={300}
                      textAlignVertical="top"
                    />
                  </View>
                  <Text style={s.hint}>{intro.length}/300</Text>
                </View>

                {/* 안내 */}
                <View style={s.warningCard}>
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color="#F59E0B"
                    style={s.warningIcon}
                  />
                  <View style={s.warningContent}>
                    <Text style={s.warningTitle}>가입 승인 안내</Text>
                    <Text style={s.warningText}>
                      크루장이 신청을 승인하면 크루에 참여할 수 있습니다.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* 하단 버튼 */}
            <View style={s.footer}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={s.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.joinBtn,
                  (!intro.trim() || loading) && s.joinBtnDisabled,
                ]}
                onPress={handleJoin}
                disabled={!intro.trim() || loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.joinBtnText}>
                  {loading ? "신청 중..." : "가입 신청"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: "#6366F1",
    alignItems: "center",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 24,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  crewImageContainer: {
    marginBottom: 16,
  },
  crewImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  crewName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  progressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    padding: 24,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
  },
  description: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  required: {
    color: "#EF4444",
  },
  inputWrapper: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
  },
  textarea: {
    fontSize: 15,
    color: "#1F2937",
    minHeight: 120,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
  },
  warningCard: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  warningIcon: {
    marginTop: 2,
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  joinBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
