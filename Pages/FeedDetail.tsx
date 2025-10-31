import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from "react-native";
import { NegativeAlert, PositiveAlert, DestructiveConfirm, MessageAlert, ConfirmAlert } from "../components/ui/AlertDialog";
import { getMyProfile } from "../utils/api/users";
import { deleteFeed as apiDeleteFeed } from "../utils/api/feeds";

const { width } = Dimensions.get("window");
// 공용 client를 사용해 HTTPS 및 JWT 자동 처리를 일원화합니다.

export default function FeedDetail({ route, navigation }: any) {
  const { feed } = route.params;
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  const [confirm, setConfirm] = useState<{ open:boolean; title?:string; message?:string }>();

  // ✅ 사용자 정보 가져오기
  const fetchUserData = useCallback(async () => {
    try {
      const meRes = await getMyProfile();
      setMe(meRes);
    } catch (err) {
      console.warn(err);
      setAlert({ open:true, kind:'negative', title:'오류', message: err?.response?.data?.message || '사용자 정보를 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // 필드 매핑(백엔드 snake/camel 혼용 대응)
  const profileUrl = me?.profile_image_url || me?.profileImageUrl || "";

  // ✅ 러닝 시간 포맷 (항상 h:mm:ss)
  const formatDuration = (seconds) => {
    if (!seconds) return "0:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  };

  // ✅ 피드 삭제 핸들러
  const handleDelete = async () => {
    setConfirm({ open:true, title:'삭제 확인', message:'이 게시물을 삭제하시겠습니까?' });
  };

  return (
    <SafeAreaView style={styles.container}>
      {alert.open && alert.kind === 'positive' && (
        <PositiveAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert.open && alert.kind === 'negative' && (
        <NegativeAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert.open && alert.kind === 'message' && (
        <MessageAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {confirm?.open && (
        <DestructiveConfirm
          visible
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm(undefined)}
          onCancel={() => setConfirm(undefined)}
          onConfirm={async () => {
            try {
              await apiDeleteFeed(feed.id);
              setAlert({ open:true, kind:'positive', title:'삭제 완료', message:'피드가 삭제되었습니다.' });
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Feed', { deletedId: feed.id });
            } catch (error) {
              console.error(error);
              setAlert({ open:true, kind:'negative', title:'오류', message:'피드 삭제에 실패했습니다.' });
            } finally {
              setConfirm(undefined);
            }
          }}
        />
      )}
      {/* 상단 모사 상태바 제거 */}

      {/* 피드 카드 */}
      <ScrollView contentContainerStyle={styles.feedArea}>
        <View style={styles.feedCard}>
          {/* 프로필 영역 */}
          <View style={styles.feedHeader}>
            <Image
              source={
                profileUrl
                  ? { uri: profileUrl }
                  : require("../assets/ix-user-profile0.png")
              }
              style={styles.profileIcon}
            />
            <View>
              <Text style={styles.feedAuthor}>{feed.nickname}</Text>
              <Text style={styles.feedTime}>방금 전</Text>
            </View>
            <TouchableOpacity
              style={{ marginLeft: "auto" }}
              onPress={handleDelete}
            >
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* 본문 */}
          <Text style={styles.feedContent}>{feed.content}</Text>

          {/* 기록 박스 */}
          <View style={styles.recordBox}>
            <View style={styles.recordItem}>
              <Text style={styles.recordValue}>
                {feed.distance ? `${feed.distance.toFixed(2)} km` : "-"}
              </Text>
              <Text style={styles.recordLabel}>거리</Text>
            </View>
            <View style={styles.recordItem}>
              <Text style={styles.recordValue}>
                {formatDuration(feed.duration)}
              </Text>
              <Text style={styles.recordLabel}>시간</Text>
            </View>
            <View style={styles.recordItem}>
              <Text style={styles.recordValue}>{feed.averagePace || "-"}</Text>
              <Text style={styles.recordLabel}>페이스</Text>
            </View>
          </View>

          {/* 이미지 */}
          {feed.imageUrl && (
            <Image
              source={{ uri: feed.imageUrl }}
              style={styles.feedImage}
              resizeMode="cover"
            />
          )}
        </View>
      </ScrollView>

      {/* 하단 네비 제거: 상세 화면에서는 표시하지 않음 */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // 상태바
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  time: { fontSize: 16, fontWeight: "600" },
  levels: { flexDirection: "row", gap: 6 },

  // 피드 영역 - 상단 패딩 추가하여 카드를 아래로 내림
  feedArea: {
    padding: 20,
    paddingTop: 30, // 상단 패딩을 늘려서 카드를 아래로 내림
  },

  feedCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  profileIcon: { width: 28, height: 28, marginRight: 8, borderRadius: 14 },
  feedAuthor: { fontWeight: "700", fontSize: 14, color: "#000" },
  feedTime: { fontSize: 12, color: "#000000ff" },
  feedContent: { fontSize: 14, marginBottom: 12, color: "#000" },

  // 기록 박스
  recordBox: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 12,
    marginBottom: 12,
  },
  recordItem: { alignItems: "center", flex: 1 },
  recordValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    fontWeight: 500,
    color: "#000",
  },
  recordLabel: { fontSize: 15, color: "#718096" },

  // 이미지 - 세로 길이를 더 길게 증가
  feedImage: {
    width: "100%",
    height: 530, // 250 -> 530으로 증가
    borderRadius: 12,
    marginBottom: 0,
  },

  // 바텀 네비
  // (제거)
});
