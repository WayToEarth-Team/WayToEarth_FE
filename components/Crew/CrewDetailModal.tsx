import React, { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCrewById, type CrewPublicDetail } from "../../utils/api/crews";
import WeeklyMVPSection from "./WeeklyMVPSection";
import CrewHeaderCard from "./CrewHeaderCard";
import CrewDescription from "./CrewDescription";
import JoinIntroInput from "./JoinIntroInput";

type Props = {
  visible: boolean;
  crewId: string;
  onClose: () => void;
  onApply?: (intro?: string) => Promise<void> | void;
  initialName?: string;
  initialProgress?: string; // e.g., "12/50"
};

export default function CrewDetailModal({
  visible,
  crewId,
  onClose,
  onApply,
  initialName,
  initialProgress,
}: Props) {
  const [detail, setDetail] = useState<CrewPublicDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intro, setIntro] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!crewId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    getCrewById(crewId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
      })
      .catch((e) => {
        if (!alive) return;
        const msg = e?.response?.data?.message || e?.message || "크루 정보를 불러오지 못했습니다.";
        setError(msg);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, crewId]);

  const name = detail?.name || initialName || "";
  const progress = useMemo(() => {
    if (detail) return `${detail.currentMembers}/${detail.maxMembers}`;
    return initialProgress;
  }, [detail, initialProgress]);

  const submit = async () => {
    if (!onApply || applying) return;
    try {
      setApplying(true);
      await onApply(intro.trim());
      setIntro("");
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.headerRow}>
            <Text style={s.headerTitle}>크루 정보</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <CrewHeaderCard
              name={name}
              progress={progress || undefined}
              profileImageUrl={detail?.profileImageUrl}
              ownerNickname={detail?.ownerNickname}
              isActive={detail?.isActive}
            />
            <CrewDescription description={detail?.description} />

            {/* 이번주 MVP 섹션: 훅 + 프리젠테이션 컴포넌트 */}
            {crewId ? <WeeklyMVPSection crewId={crewId} /> : null}

            {loading && (
              <View style={s.loadingBox}>
                <ActivityIndicator color="#4A90E2" />
                <Text style={s.loadingText}>불러오는 중…</Text>
              </View>
            )}
            {error && !loading && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" color="#ef4444" size={18} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <JoinIntroInput value={intro} onChange={setIntro} onSubmit={submit} submitting={applying} />
          </ScrollView>

          {/* 버튼은 JoinIntroInput 내부에서 렌더링 */}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  loadingText: { marginLeft: 8, color: "#6B7280", fontSize: 12 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  errorText: { marginLeft: 6, color: "#ef4444", fontSize: 12 },
});
