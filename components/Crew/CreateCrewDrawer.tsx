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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.85;

interface CreateCrewDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}

export default function CreateCrewDrawer({
  visible,
  onClose,
  onSubmit,
}: CreateCrewDrawerProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name, description);
      setName("");
      setDescription("");
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
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
              <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <View style={s.headerTop}>
                  <View style={s.headerLeft}>
                    <View style={s.iconBg}>
                      <Ionicons name="people" size={24} color="#6366F1" />
                    </View>
                    <Text style={s.headerTitle}>크루 생성</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={s.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={28} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={s.headerSubtitle}>
                  새로운 크루를 만들고 함께 달려보세요
                </Text>
              </View>

              {/* 폼 */}
              <View style={s.form}>
                <View style={s.inputGroup}>
                  <Text style={s.label}>
                    크루 이름 <Text style={s.required}>*</Text>
                  </Text>
                  <View style={s.inputWrapper}>
                    <Ionicons
                      name="flag-outline"
                      size={20}
                      color="#9CA3AF"
                      style={s.inputIcon}
                    />
                    <TextInput
                      style={s.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="예) 아침 러닝 크루"
                      placeholderTextColor="#9CA3AF"
                      maxLength={30}
                    />
                  </View>
                  <Text style={s.hint}>{name.length}/30</Text>
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>크루 소개</Text>
                  <View style={[s.inputWrapper, s.textareaWrapper]}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color="#9CA3AF"
                      style={[s.inputIcon, s.textareaIcon]}
                    />
                    <TextInput
                      style={[s.input, s.textarea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="크루에 대해 간단히 소개해주세요"
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      maxLength={200}
                      textAlignVertical="top"
                    />
                  </View>
                  <Text style={s.hint}>{description.length}/200</Text>
                </View>

                {/* 안내 카드 */}
                <View style={s.infoCard}>
                  <View style={s.infoHeader}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#6366F1"
                    />
                    <Text style={s.infoTitle}>크루 생성 안내</Text>
                  </View>
                  <View style={s.infoList}>
                    <View style={s.infoItem}>
                      <View style={s.infoDot} />
                      <Text style={s.infoText}>
                        크루를 생성하면 자동으로 크루장이 됩니다
                      </Text>
                    </View>
                    <View style={s.infoItem}>
                      <View style={s.infoDot} />
                      <Text style={s.infoText}>
                        크루 이름과 소개는 나중에 수정할 수 있습니다
                      </Text>
                    </View>
                    <View style={s.infoItem}>
                      <View style={s.infoDot} />
                      <Text style={s.infoText}>
                        한 번에 하나의 크루만 참여할 수 있습니다
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* 하단 버튼 */}
            <View style={[s.footer, { paddingBottom: Math.max(16, insets.bottom + 16) }]}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={s.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.submitBtn,
                  (!name.trim() || loading) && s.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!name.trim() || loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.submitBtnText}>
                  {loading ? "생성 중..." : "크루 생성"}
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
    paddingBottom: 24,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginLeft: 52,
  },
  form: {
    padding: 24,
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  required: {
    color: "#EF4444",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textareaWrapper: {
    alignItems: "flex-start",
  },
  inputIcon: {
    marginRight: 10,
  },
  textareaIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
    padding: 0,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
  },
  infoCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4338CA",
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#6366F1",
    marginTop: 7,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#4338CA",
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
  submitBtn: {
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
  submitBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
