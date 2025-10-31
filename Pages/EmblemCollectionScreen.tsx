import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
} from "react-native";
import { NegativeAlert } from "../components/ui/AlertDialog";
import type { Achievement, Summary, EmblemFilter } from "../types/emblem";
import { getEmblemSummary, getEmblemCatalog } from "../utils/api/emblems";

const EmblemCollectionScreen: React.FC<{ navigation?: any }> = ({
  navigation,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<EmblemFilter>("전체");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [alert, setAlert] = useState<{ open:boolean; title?:string; message?:string }>( { open:false } );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sum, catalog] = await Promise.all([
        getEmblemSummary(),
        getEmblemCatalog({ filter: "ALL", size: 50 }),
      ]);
      setSummary(sum);
      setAchievements(catalog);
    } catch (e) {
      console.error(e);
      setAlert({ open:true, title:'에러', message:'엠블럼 데이터를 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const list = (() => {
    if (selectedFilter === "획득") return achievements.filter((a) => a.owned);
    if (selectedFilter === "미획득")
      return achievements.filter((a) => !a.owned);
    return achievements;
  })();

  const owned = summary?.owned ?? 0;
  const total = summary?.total ?? 0;
  const completion = summary
    ? Math.round((summary.completion_rate ?? 0) * 100)
    : 0;

  const Stat: React.FC = () => (
    <View style={s.statsContainer}>
      <Text style={s.statsTitle}>컬렉션 현황</Text>
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statNumber}>{owned}</Text>
          <Text style={s.statLabel}>획득</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statNumber}>{total}</Text>
          <Text style={s.statLabel}>전체</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statNumber}>{completion}%</Text>
          <Text style={s.statLabel}>완성도</Text>
        </View>
      </View>
    </View>
  );

  const Card: React.FC<{ a: Achievement }> = ({ a }) => (
    <View
      style={[
        s.card,
        { borderLeftColor: a.owned ? "#2c5530" : "#ccc" },
        !a.owned && s.lockedCard,
      ]}
    >
      <View style={s.badgeBox}>
        <Image
          source={{ uri: a.image_url }}
          style={[s.badge, !a.owned && s.lockedImg]}
          resizeMode="contain"
        />
      </View>
      <Text style={[s.cardTitle, !a.owned && s.lockedText]}>{a.name}</Text>
      <Text style={[s.cardDesc, !a.owned && s.lockedText]}>
        {a.description}
      </Text>
      <Text style={[s.cardDate, !a.owned && s.lockedText]}>
        {a.earned_at ? new Date(a.earned_at).toLocaleDateString("ko-KR") : "🔒"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={s.loading}>
          <ActivityIndicator size="large" />
          <Text style={s.loadingText}>엠블럼을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {alert.open && (
        <NegativeAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false })} />
      )}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={s.header}>
        <TouchableOpacity
          style={s.back}
          activeOpacity={0.7}
          onPress={() => navigation?.goBack?.()}
        >
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.hTitle}>엠블럼 컬렉션</Text>
        <View style={s.hSpacer} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <View style={s.heroBg}>
            <Text style={s.heroTitle}>🏆 명예의 전당</Text>
            <Text style={s.heroSub}>이평강 러너의 위대한 여정</Text>
          </View>
        </View>

        <Stat />

        <View style={s.filters}>
          {(["전체", "획득", "미획득"] as EmblemFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[s.fBtn, selectedFilter === f && s.fBtnActive]}
              onPress={() => setSelectedFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[s.fTxt, selectedFilter === f && s.fTxtActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.grid}>
          {list.map((a) => (
            <Card key={a.emblem_id} a={a} />
          ))}
        </View>

        {list.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTxt}>
              {selectedFilter === "획득"
                ? "아직 획득한 엠블럼이 없습니다."
                : selectedFilter === "미획득"
                ? "모든 엠블럼을 획득했습니다!"
                : "엠블럼이 없습니다."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  back: { padding: 8, borderRadius: 8 },
  backTxt: { fontSize: 24, color: "#333", fontWeight: "600" },
  hTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    textAlign: "center",
    marginLeft: -32,
  },
  hSpacer: { width: 40 },

  scroll: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollContent: { paddingBottom: 32 },

  hero: { margin: 16, marginBottom: 16 },
  heroBg: {
    backgroundColor: "#2c5530",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  heroSub: { color: "#fff", fontSize: 15, textAlign: "center", opacity: 0.9 },

  statsContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statsTitle: {
    color: "#333",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  statItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statNumber: {
    color: "#2c5530",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: { color: "#666", fontSize: 13, fontWeight: "500" },

  filters: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  fBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 2,
    borderRadius: 8,
    minHeight: 44,
  },
  fBtnActive: {
    backgroundColor: "#2c5530",
    elevation: 1,
    shadowColor: "#2c5530",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  fTxt: { fontSize: 15, fontWeight: "500", color: "#666" },
  fTxtActive: { color: "#fff", fontWeight: "600" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "48%",
    marginBottom: 16,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    minHeight: 200,
    justifyContent: "space-between",
  },
  lockedCard: { backgroundColor: "#f8f9fa", opacity: 0.6 },
  badgeBox: {
    alignItems: "center",
    marginBottom: 12,
    flex: 1,
    justifyContent: "center",
  },
  badge: { width: 60, height: 60, borderRadius: 30 },
  lockedImg: { opacity: 0.4 },
  cardTitle: {
    color: "#333",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 18,
  },
  cardDesc: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 16,
    flex: 1,
  },
  cardDate: {
    color: "#2c5530",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: "auto",
  },
  lockedText: { color: "#999" },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyTxt: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
});

export default EmblemCollectionScreen;
