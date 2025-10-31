import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert } from "../components/ui/AlertDialog";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import TopCrewItem from "../components/Crew/TopCrewItem";
import CrewCard from "../components/Crew/CrewCard";
import SearchBar from "../components/Crew/SearchBar";
import MyCrewCard from "../components/Crew/MyCrewCard";
import { useCrewData } from "../hooks/useCrewData";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import CreateCrewSheet from "../components/Crew/CreateCrewSheet";
import CrewPreviewSheet from "../components/Crew/CrewPreviewSheet";
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
  // 탭 내비게이터 사용: 개별 화면에서 하단 바를 렌더하지 않음
  const navigation = useNavigation<any>();
  const [dialog, setDialog] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3B82F6" translucent={false} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
          if (isCloseToBottom && !loadingMore && hasMore) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* 상단 랭킹 */}
        <LinearGradient
          colors={["#3B82F6", "#2563EB", "#1D4ED8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.topWrap}
        >
          {(function orderTop() {
            const a = topCrews;
            if (!a || a.length === 0) return null;

            // topCrews는 순서대로 [1등, 2등, 3등] 형태로 들어옴
            // 화면 배치: [2등(왼쪽), 1등(중앙), 3등(오른쪽)]
            // 1등은 항상 중앙에 표시, 2등/3등은 있을 때만 양옆에 표시

            const first = a[0];   // 1등 (항상 존재)
            const second = a[1];  // 2등 (없을 수 있음)
            const third = a[2];   // 3등 (없을 수 있음)

            // 3개 슬롯: [2등 자리, 1등 자리, 3등 자리]
            const slots = [second, first, third];

            return slots.map((c, idx) => {
              if (!c) {
                // 빈 슬롯: 공간만 차지하고 아무것도 렌더링하지 않음
                return <View key={`empty-${idx}`} style={s.topItemWrap} />;
              }

              // idx=1이 1등(중앙)이므로 크게(lg), 나머지는 중간 크기(md)
              const size = idx === 1 ? "lg" : "md";
              // 1등(중앙)을 가장 높이, 2/3등은 조금 내려서 삼각형 배치
              const offset = idx === 1 ? 20 : 40;

              return (
                <View key={c.id} style={[s.topItemWrap, { marginTop: offset }]}>
                  <TopCrewItem
                    rank={c.rank}
                    distance={c.distance}
                    name={c.name}
                    image={c.imageUrl ? { uri: c.imageUrl } : undefined}
                    size={size}
                    onPress={() => {}}
                  />
                </View>
              );
            });
          })()}
        </LinearGradient>

        {/* 목록 섹션 */}
        <View style={s.content}>
          <View style={s.titleRow}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={s.title}>크루 목록</Text>
          </View>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onSearch={() => {}}
          />

          {/* 내 크루가 없으면 생성 유도 */}
          {!myCrew && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyText}>현재 크루가 없습니다</Text>
              <TouchableOpacity
                style={s.createBtn}
                onPress={() => setCreateOpen(true)}
              >
                <Text style={s.createBtnText}>크루 생성</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 내 크루 고정 노출 (1번 위치) */}
          {myCrew && (
            <MyCrewCard
              name={myCrew.name}
              description={myCrew.description}
              progress={myCrew.progress}
              imageUrl={myCrew.imageUrl}
              onPress={() => navigation.navigate("CrewDetail")}
            />
          )}

          {/* 목록 */}
          {crews.map((c) => (
            <CrewCard
              key={c.id}
              name={c.name}
              description={c.description}
              progress={c.progress}
              imageUrl={c.imageUrl}
              onPress={() => {
                if (!myCrew) {
                  setSelected({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    progress: c.progress,
                  });
                  setPreviewOpen(false);
                  setDetailOpen(true);
                } else {
                  setDialog({ open:true, kind:'message', title:'가입 불가', message:'현재 가입된 크루가 이미 있습니다.' });
                }
              }}
            />
          ))}

          {/* 로딩 인디케이터 */}
          {loadingMore && (
            <View style={s.loadingMore}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text style={s.loadingText}>크루 목록 불러오는 중...</Text>
            </View>
          )}

          {/* 더 이상 없음 표시 */}
          {!hasMore && crews.length > 0 && (
            <View style={s.endMessage}>
              <Text style={s.endText}>모든 크루를 불러왔습니다</Text>
            </View>
          )}

          {/* 하단 여백 - 탭 네비게이션 가림 방지 */}
          <View style={s.bottomSpacer} />
        </View>
      </ScrollView>

      {/* 탭 내비게이터 사용으로 하단 바는 전역에서 렌더링됨 */}

      {/* 크루 생성 바텀 시트 */}
      <CreateCrewSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name, description) => {
          try {
            if (!name?.trim()) return;
            await createMyCrew(name, description);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || "크루 생성에 실패했습니다. 잠시 후 다시 시도해주세요.";
            setDialog({ open:true, kind:'negative', title:'생성 실패', message: msg });
          }
        }}
      />

      {/* 크루 미리보기 (내 크루 없을 때 다른 크루 클릭 시) */}
      <CrewPreviewSheet
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
                  // 승인 대기 안내
                  if ((res as any)?.pending) {
                    setDialog({ open:true, kind:'message', title:'신청 완료', message:'관리자 승인 후 크루에 참여할 수 있습니다.' });
                  } else {
                    setDialog({ open:true, kind:'positive', title:'가입 완료', message:'크루에 가입되었습니다.' });
                  }
                } catch (e: any) {
                  const msg = e?.code === "JOIN_PENDING_EXISTS"
                    ? "이미 해당 크루에 가입 신청이 접수되어 있습니다. 승인/거절 결과를 기다려주세요."
                    : (e?.response?.data?.message || e?.message || "가입 신청에 실패했습니다.");
                  setDialog({ open:true, kind:'negative', title:'신청 불가', message: msg });
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
                    setDialog({ open:true, kind:'message', title:'신청 완료', message:'관리자 승인 후 크루에 참여할 수 있습니다.' });
                  } else {
                    setDialog({ open:true, kind:'positive', title:'가입 완료', message:'크루에 가입되었습니다.' });
                  }
                } catch (e: any) {
                  const msg =
                    e?.code === "JOIN_PENDING_EXISTS"
                      ? "이미 해당 크루에 가입 신청이 접수되어 있습니다. 승인/거절 결과를 기다려주세요."
                      : e?.response?.data?.message || e?.message || "가입 신청 중 오류가 발생했습니다.";
                  setDialog({ open:true, kind:'negative', title:'신청 실패', message: msg });
                }
              }
            : undefined
        }
      />
      {dialog.open && dialog.kind === 'positive' && (
        <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'negative' && (
        <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'message' && (
        <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 24,
    paddingHorizontal: 16,
    position: "relative",
    overflow: "hidden",
  },
  topItemWrap: { width: "32%", alignItems: "center", zIndex: 1 },
  content: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    marginBottom: 24,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#999", marginBottom: 16 },
  createBtn: {
    backgroundColor: "#000",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#6B7280",
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
    height: 150,
  },
});
