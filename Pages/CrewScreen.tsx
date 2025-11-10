import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PositiveAlert,
  NegativeAlert,
  MessageAlert,
} from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
import TopCrewItem from "../components/Crew/TopCrewItem";
import CrewGridItem from "../components/Crew/CrewGridItem";
import { useCrewData } from "../hooks/useCrewData";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import CreateCrewDrawer from "../components/Crew/CreateCrewDrawer";
import CrewPreviewDrawer from "../components/Crew/CrewPreviewDrawer";
import CrewDetailModal from "../components/Crew/CrewDetailModal";

export default function CrewScreen() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<{
    id?: string;
    name: string;
    description?: string;
    progress?: string;
  } | null>(null);
  const {
    topCrews,
    crews,
    myCrew,
    loadingMore,
    hasMore,
    createMyCrew,
    joinExistingCrew,
    refresh,
    loadMore,
  } = useCrewData(search);
  const navigation = useNavigation<any>();
  const [dialog, setDialog] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    kind?: "positive" | "negative" | "message";
  }>({ open: false, kind: "message" });

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <SafeAreaView style={s.safeContainer}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      {/* 상단 헤더 */}
      <View style={s.header}>
        {/* 검색바 */}
        <View style={s.searchContainer}>
          <View style={s.searchBox}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="대회, 러닝크루 검색"
              placeholderTextColor="#9CA3AF"
            />
            <Ionicons name="search" size={20} color="#9CA3AF" />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 200;
          if (isCloseToBottom && !loadingMore && hasMore) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* 크루 둘러보기 섹션 */}
        <View style={s.content}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>러닝크루 둘러보기</Text>
            <TouchableOpacity onPress={() => setCreateOpen(true)}>
              <Ionicons name="add-circle" size={28} color="#6366F1" />
            </TouchableOpacity>
          </View>

          {/* 내 크루가 없으면 생성 유도 */}
          {!myCrew && (
            <TouchableOpacity
              style={s.emptyCard}
              onPress={() => setCreateOpen(true)}
            >
              <View style={s.emptyContent}>
                <Ionicons
                  name="people"
                  size={48}
                  color="#9CA3AF"
                  style={{ marginBottom: 12 }}
                />
                <Text style={s.emptyTitle}>크루가 없습니다</Text>
                <Text style={s.emptySubtitle}>새로운 크루를 만들어보세요</Text>
              </View>
              <View style={s.createBadge}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          )}

          {/* 내 크루 별도 카드 제거: 그리드 첫 번째로 통합 */}

          {/* 크루 목록: 2열 그리드 (이름 + 인원 + 프사) */}
          <View style={s.gridWrap}>
            {(myCrew ? [myCrew, ...crews] : crews).map((c, idx) => {
              const isMine = Boolean(myCrew) && idx === 0;
              const displayName = isMine ? "내 크루" : c.name;
              const onPress = () => {
                if (isMine) {
                  navigation.navigate("CrewDetail");
                } else {
                  setSelected({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    progress: c.progress,
                  });
                  setPreviewOpen(false);
                  setDetailOpen(true);
                }
              };
              return (
                <CrewGridItem
                  key={`${c.id}-${isMine ? "mine" : "other"}`}
                  name={displayName}
                  progress={c.progress}
                  imageUrl={c.imageUrl}
                  onPress={onPress}
                />
              );
            })}
          </View>

          {/* 로딩 */}
          {loadingMore && (
            <View style={s.loadingMore}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          )}

          {!hasMore && crews.length > 0 && (
            <View style={s.endMessage}>
              <Text style={s.endText}>모든 크루를 불러왔습니다</Text>
            </View>
          )}

          <View style={s.bottomSpacer} />
        </View>
      </ScrollView>

      {/* 드로어 & 모달 */}
      <CreateCrewDrawer
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name, description) => {
          try {
            if (!name?.trim()) return;
            // 이미 내 크루가 있는 경우: 생성 불가 커스텀 메시지
            if (myCrew) {
              setDialog({
                open: true,
                kind: "negative",
                title: "생성 불가",
                message:
                  "이미 가입된 크루가 있어 새 크루를 생성할 수 없습니다.",
              });
              return;
            }
            await createMyCrew(name, description);
          } catch (e: any) {
            const data = e?.response?.data || {};
            const err = (data as any)?.error || {};
            const code = (err?.code || (data as any)?.code || "").toString();
            const raw =
              err?.message ||
              (data as any)?.message ||
              e?.message ||
              "크루 생성에 실패했습니다.";
            const friendly =
              /ALREADY_IN_CREW|CREW_EXISTS|USER_ALREADY_MEMBER/i.test(code) ||
              /이미.*크루.*(참여|가입)/.test(raw)
                ? "이미 가입된 크루가 있어 새 크루를 생성할 수 없습니다."
                : raw;
            setDialog({
              open: true,
              kind: "negative",
              title: "생성 실패",
              message: friendly,
            });
          }
        }}
      />

      <CrewPreviewDrawer
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={selected?.name || ""}
        description={selected?.description}
        progress={selected?.progress}
        onJoin={
          selected
            ? async (intro) => {
                try {
                  const res = await joinExistingCrew(
                    {
                      id: selected.id || "",
                      name: selected.name,
                      description: selected.description || "",
                      progress: selected.progress || "0/0",
                    },
                    intro
                  );
                  setPreviewOpen(false);
                  if ((res as any)?.pending) {
                    setDialog({
                      open: true,
                      kind: "message",
                      title: "신청 완료",
                      message: "관리자 승인 후 크루에 참여할 수 있습니다.",
                    });
                  } else {
                    setDialog({
                      open: true,
                      kind: "positive",
                      title: "가입 완료",
                      message: "크루에 가입되었습니다.",
                    });
                  }
                } catch (e: any) {
                  const msg =
                    e?.code === "JOIN_PENDING_EXISTS"
                      ? "이미 해당 크루에 가입 신청이 접수되어 있습니다."
                      : e?.response?.data?.message ||
                        e?.message ||
                        "가입 신청에 실패했습니다.";
                  setDialog({
                    open: true,
                    kind: "negative",
                    title: "신청 불가",
                    message: msg,
                  });
                }
              }
            : undefined
        }
      />

      <CrewDetailModal
        visible={detailOpen}
        crewId={selected?.id || ""}
        initialName={selected?.name}
        initialProgress={selected?.progress}
        onClose={() => setDetailOpen(false)}
        onApply={
          selected
            ? async (intro) => {
                if (myCrew) {
                  setDialog({
                    open: true,
                    kind: "message",
                    title: "가입 불가",
                    message: "이미 가입된 크루가 있습니다.",
                  });
                  return;
                }

                try {
                  const res = await joinExistingCrew(
                    {
                      id: selected.id || "",
                      name: selected.name,
                      description: selected.description || "",
                      progress: selected.progress || "0/0",
                    },
                    intro
                  );
                  setDetailOpen(false);
                  if ((res as any)?.pending) {
                    setDialog({
                      open: true,
                      kind: "message",
                      title: "신청 완료",
                      message: "관리자 승인 후 크루에 참여할 수 있습니다.",
                    });
                  } else {
                    setDialog({
                      open: true,
                      kind: "positive",
                      title: "가입 완료",
                      message: "크루에 가입되었습니다.",
                    });
                  }
                } catch (e: any) {
                  const msg =
                    e?.code === "JOIN_PENDING_EXISTS"
                      ? "이미 해당 크루에 가입 신청이 접수되어 있습니다."
                      : e?.response?.data?.message ||
                        e?.message ||
                        "가입 신청 중 오류가 발생했습니다.";
                  setDialog({
                    open: true,
                    kind: "negative",
                    title: "신청 실패",
                    message: msg,
                  });
                }
              }
            : undefined
        }
      />

      {dialog.open && dialog.kind === "positive" && (
        <PositiveAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
      )}
      {dialog.open && dialog.kind === "negative" && (
        <NegativeAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
      )}
      {dialog.open && dialog.kind === "message" && (
        <MessageAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    marginTop: 15,
    backgroundColor: "#fff",
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rankingWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  rankingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  rankingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.3,
  },
  topItemsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topItemWrap: { width: "32%", alignItems: "center" },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logo: {
    width: 40,
    height: 40,
  },
  headerRight: {
    flexDirection: "row",
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 3,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
  },
  regionScroll: {
    paddingLeft: 20,
  },
  regionContainer: {
    paddingRight: 20,
    gap: 8,
  },
  regionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  regionChipActive: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  regionIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  regionEmoji: {
    fontSize: 16,
  },
  regionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  regionTextActive: {
    color: "#6366F1",
  },
  content: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    padding: 32,
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  createBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  crewCard: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
    flex: 1,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  regionBadge: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  regionBadgeDark: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  regionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  regionBadgeTextDark: {
    color: "#fff",
  },
  bookmarkBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  crewName: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1F2937",
    marginBottom: 4,
    letterSpacing: -1,
  },
  crewNameDark: {
    color: "#fff",
  },
  crewInfo: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  crewInfoDark: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  crewTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  crewTimeDark: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endMessage: {
    alignItems: "center",
    paddingVertical: 20,
  },
  endText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  bottomSpacer: {
    height: 100,
  },
});
