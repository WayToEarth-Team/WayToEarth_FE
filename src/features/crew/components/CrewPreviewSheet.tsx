import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  description?: string;
  progress?: string;
  onJoin?: (intro?: string) => void | Promise<void>;
};

export default function CrewPreviewSheet({
  visible,
  onClose,
  name,
  description,
  progress,
  onJoin,
}: Props) {
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!onJoin || loading) return;
    try {
      setLoading(true);
      await onJoin(intro.trim());
      setIntro("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>가입 신청</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.name}>{name}</Text>
              {progress ? <Text style={s.progress}>{progress}</Text> : null}
            </View>
            {description ? (
              <Text style={s.desc} numberOfLines={3}>
                {description}
              </Text>
            ) : null}
          </View>
          <TextInput
            style={[s.input, { height: 90 }]}
            placeholder="소개/한마디 (선택)"
            value={intro}
            onChangeText={setIntro}
            multiline
          />
          <View style={s.rowBtns}>
            <TouchableOpacity
              style={[s.btn, s.cancel]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={s.cancelText}>닫기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.primary, loading && { opacity: 0.6 }]}
              onPress={submit}
            >
              <Text style={s.primaryText}>
                {loading ? "신청중…" : "가입 신청하기"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  card: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: { fontSize: 16, fontWeight: "800", color: "#111827" },
  progress: { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  desc: { marginTop: 6, fontSize: 13, color: "#6B7280" },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  rowBtns: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: "#F3F4F6" },
  cancelText: { color: "#374151", fontWeight: "700" },
  primary: { backgroundColor: "#111827" },
  primaryText: { color: "#fff", fontWeight: "800" },
});
