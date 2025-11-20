import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void> | void;
};

export default function CreateCrewSheet({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    try {
      setSubmitting(true);
      await onSubmit(name.trim(), desc.trim());
      setName("");
      setDesc("");
      onClose();
    } finally {
      setSubmitting(false);
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
          <Text style={s.title}>크루 생성</Text>
          <TextInput
            style={s.input}
            placeholder="크루 이름"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[s.input, { height: 90 }]}
            placeholder="크루 소개 (선택)"
            value={desc}
            onChangeText={setDesc}
            multiline
          />
          <View style={s.row}>
            <TouchableOpacity
              style={[s.btn, s.cancel]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={s.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.primary, submitting && { opacity: 0.6 }]}
              onPress={submit}
            >
              <Text style={s.primaryText}>
                {submitting ? "생성중…" : "생성"}
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: "#F3F4F6" },
  cancelText: { color: "#374151", fontWeight: "700" },
  primary: { backgroundColor: "#111827" },
  primaryText: { color: "#fff", fontWeight: "800" },
});
