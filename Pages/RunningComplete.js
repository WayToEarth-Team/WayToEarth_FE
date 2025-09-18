import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  TextInput, // ✅ 추가
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const { width, height } = Dimensions.get("window");
const API_BASE = "http://waytoearth.duckdns.org:8080"; // ⚠️ 본인 환경에 맞게 변경

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// ✅ 모든 요청에 JWT 토큰 주입
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("jwtToken");
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

const RunningComplete = () => {
  const [loading, setLoading] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [exerciseImage, setExerciseImage] = useState(null); // ✅ 최종 S3 URL 저장
  const [comment, setComment] = useState(""); // ✅ 사용자 입력 상태 추가

  // ✅ 확장자 기반 MIME 추론
  const guessMime = (uri) => {
    const ext = (uri.split(".").pop() || "").toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  };

  // ✅ S3 업로드 함수 (uploadAsync 사용)
  const uploadToS3 = async (fileUri) => {
    try {
      const fileName = fileUri.split("/").pop() || "feed.jpg";
      const info = await FileSystem.getInfoAsync(fileUri);
      const size = typeof info?.size === "number" ? info.size : 0;
      const contentType = guessMime(fileName);

      if (size <= 0) {
        Alert.alert("오류", "파일 크기를 확인할 수 없습니다.");
        return null;
      }
      if (size > 5 * 1024 * 1024) {
        Alert.alert("용량 초과", "최대 5MB까지 업로드할 수 있습니다.");
        return null;
      }

      // Presigned URL 요청
      const { data } = await api.post("/v1/files/presign/feed", {
        fileName,
        contentType,
        size,
      });
      console.log("[presign]", data);

      const signedUrl = data?.upload_url ?? data?.signed_url ?? data?.uploadUrl;
      const publicUrl = data?.public_url ?? data?.publicUrl;

      if (!signedUrl || !publicUrl) {
        Alert.alert("오류", "업로드 URL 발급에 실패했습니다.");
        return null;
      }

      // S3 업로드 (PUT)
      const resUpload = await FileSystem.uploadAsync(signedUrl, fileUri, {
        httpMethod: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(size),
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (!(resUpload.status === 200 || resUpload.status === 204)) {
        throw new Error(`S3 업로드 실패: ${resUpload.status}`);
      }

      console.log("[s3 uploaded]", publicUrl);
      return publicUrl;
    } catch (err) {
      console.warn(err);
      Alert.alert("오류", "이미지 업로드에 실패했습니다.");
      return null;
    }
  };

  // ✅ 운동 추가하기 (이미지 선택 + S3 업로드)
  const pickExerciseImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const localUri = result.assets[0].uri;
        console.log("[exercise image selected]", localUri);

        const s3Url = await uploadToS3(localUri);
        if (s3Url) setExerciseImage(s3Url);
      }
    } catch (e) {
      console.warn(e);
      Alert.alert("오류", "이미지 선택에 실패했습니다.");
    }
  }, []);

  // ✅ 러닝 시작
  const startRunning = useCallback(async () => {
    try {
      setLoading(true);
      const sid = `mock-${Date.now()}`;
      const { data } = await api.post("/v1/running/start", {
        sessionId: sid,
        runningType: "SINGLE",
      });
      console.log("[running started]", data);
      setSessionId(sid);
      await AsyncStorage.setItem("runningSessionId", sid);
    } catch (e) {
      console.warn(e);
      Alert.alert("오류", "러닝 시작에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ 러닝 완료
  const completeRunning = useCallback(async () => {
    try {
      setLoading(true);
      const sid = sessionId || (await AsyncStorage.getItem("runningSessionId"));
      if (!sid) {
        Alert.alert("세션 없음", "먼저 러닝을 시작해주세요.");
        return;
      }

      const payload = {
        sessionId: sid,
        distanceMeters: 3240,
        durationSeconds: 1165,
        averagePaceSeconds: 346,
        calories: 341,
        routePoints: [
          { latitude: 37.5665, longitude: 126.978, sequence: 0 },
          { latitude: 37.567, longitude: 126.979, sequence: 1 },
        ],
      };

      console.log("[complete payload]", payload);

      const { data } = await api.post("/v1/running/complete", payload);
      console.log("[running completed]", data);
      setRecordId(data.runningRecordId ?? data.recordId ?? data.id);

      await AsyncStorage.removeItem("runningSessionId");
    } catch (e) {
      console.warn(e);
      Alert.alert("오류", "러닝 완료에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // ✅ 공유 버튼 → 피드 작성
  const onShare = useCallback(async () => {
    if (!recordId) {
      Alert.alert("잠시 후 다시 시도해주세요.");
      return;
    }
    if (!comment.trim()) {
      Alert.alert("입력 필요", "러닝 후기를 작성해주세요!");
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.post("/v1/feeds", {
        runningRecordId: recordId,
        content: comment, // ✅ 사용자 입력 전달
        imageUrl: exerciseImage ?? "https://picsum.photos/400/300",
      });
      console.log("[feed created]", data);
      Alert.alert("완료", "피드가 공유되었습니다!");
      setComment(""); // 입력 초기화
    } catch (e) {
      console.warn(e);
      Alert.alert("오류", "피드 공유에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [recordId, exerciseImage, comment]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.time}>9:41</Text>
        <View style={styles.statusIcons}>
          <View style={styles.signalBars}>
            <View style={[styles.bar, { height: 4 }]} />
            <View style={[styles.bar, { height: 6 }]} />
            <View style={[styles.bar, { height: 8 }]} />
            <View style={[styles.bar, { height: 10 }]} />
          </View>
          <Text style={styles.wifiIcon}>📶</Text>
          <View style={styles.battery}>
            <View style={styles.batteryLevel} />
            <View style={styles.batteryTip} />
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.overlay1} />
        <View style={styles.overlay2} />

        <Text style={styles.title}>Way to Earth</Text>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3.24</Text>
            <Text style={styles.statLabel}>거리(km)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>5:46</Text>
            <Text style={styles.statLabel}>평균 페이스</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>341</Text>
            <Text style={styles.statLabel}>칼로리</Text>
          </View>
        </View>

        {/* Comment Card */}
        <View style={styles.commentCard}>
          <Text style={styles.commentPrompt}>
            오늘 러닝 어떠나요? 한 줄로 남겨보세요!
          </Text>
          <TextInput
            style={styles.commentText}
            placeholder="러닝 후기를 입력해주세요"
            placeholderTextColor="#aaa"
            value={comment}
            onChangeText={setComment}
          />
        </View>

        {/* Add Exercise Button */}
        <TouchableOpacity
          style={styles.addExerciseContainer}
          onPress={pickExerciseImage}
        >
          {exerciseImage ? (
            <Image
              source={{ uri: exerciseImage }}
              style={{ width: 120, height: 120, borderRadius: 16 }}
            />
          ) : (
            <>
              <View style={styles.addButton}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
              <Text style={styles.addExerciseText}>운동 추가하기</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.shareButton, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={startRunning}
        >
          <Text style={styles.shareButtonText}>러닝 시작</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareButton, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={completeRunning}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.shareButtonText}>러닝 완료</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareButton, loading && { opacity: 0.6 }]}
          disabled={loading}
          onPress={onShare}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.shareButtonText}>공유하기</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ✅ 스타일 그대로 유지
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#000",
  },
  time: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statusIcons: { flexDirection: "row", alignItems: "center" },
  signalBars: { flexDirection: "row", alignItems: "flex-end", marginRight: 8 },
  bar: {
    width: 3,
    backgroundColor: "#fff",
    borderRadius: 1,
    marginHorizontal: 1,
  },
  wifiIcon: { fontSize: 8, color: "#fff", marginRight: 8 },
  battery: {
    width: 24,
    height: 12,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  batteryLevel: {
    width: "73%",
    height: "70%",
    backgroundColor: "#fff",
    borderRadius: 1,
  },
  batteryTip: {
    width: 2,
    height: 6,
    backgroundColor: "#fff",
    borderRadius: 1,
    position: "absolute",
    right: -3,
  },
  mainContent: { flex: 1, position: "relative", paddingHorizontal: 24 },
  overlay1: {
    width: 100,
    height: 100,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 50,
    position: "absolute",
    right: -50,
    top: 80,
  },
  overlay2: {
    width: 60,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 30,
    position: "absolute",
    left: -30,
    bottom: 160,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 40,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(5, 5, 5, 0.2)",
    padding: 20,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    color: "#000",
    fontWeight: "400",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#000",
    fontWeight: "500",
    textAlign: "center",
  },
  statUnit: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
    marginTop: 4,
  },
  commentCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  commentPrompt: {
    fontSize: 14.4,
    fontWeight: "700",
    color: "#d9d9d9",
    marginBottom: 15,
    lineHeight: 23,
  },
  commentText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(0, 0, 0, 0.79)",
    marginBottom: 8,
  },
  commentSubText: { fontSize: 16, fontWeight: "400", color: "#000" },
  addExerciseContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(110, 107, 107, 0.3)",
    borderStyle: "dashed",
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  addButton: {
    backgroundColor: "#000",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "rgba(255, 107, 107, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 10,
  },
  plusIcon: { color: "#fff", fontSize: 32, fontWeight: "300" },
  addExerciseText: { fontSize: 16, fontWeight: "500", color: "#000" },
  shareButton: {
    backgroundColor: "#000",
    borderRadius: 25,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "rgba(255, 107, 107, 0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 10,
  },
  shareButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cancelButton: {
    backgroundColor: "#000",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  cancelButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});

export default RunningComplete;
