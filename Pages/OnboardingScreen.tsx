import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert } from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import { submitOnboarding, checkNickname } from "../utils/api/users";
import { client } from "../utils/api/client";

const { width } = Dimensions.get("window");

type AgeGroup = "10대" | "20대" | "30대" | "40대" | "50대" | "60대 이상";
type Gender = "남성" | "여성" | "기타";

const AGE_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: "10대", label: "10대" },
  { value: "20대", label: "20대" },
  { value: "30대", label: "30대" },
  { value: "40대", label: "40대" },
  { value: "50대", label: "50대" },
  { value: "60대 이상", label: "60대 이상" },
];

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "남성", label: "남성", icon: "male" },
  { value: "여성", label: "여성", icon: "female" },
  { value: "기타", label: "기타", icon: "person" },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);

  // Form state
  const [step, setStep] = useState(0);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [residence, setResidence] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState("");

  // UI state
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 닉네임 중복 확인
  useEffect(() => {
    const trimmed = nickname?.trim() || "";
    if (!trimmed || trimmed.length < 2) {
      setNicknameError(null);
      setNicknameChecking(false);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setNicknameChecking(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await checkNickname(trimmed);
        setNicknameError(res.isDuplicate ? "이미 사용 중인 닉네임입니다" : null);
      } catch {
        setNicknameError(null);
      } finally {
        setNicknameChecking(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [nickname]);

  // MIME 타입 추론
  const guessMime = (nameOrUri: string) => {
    const ext = (nameOrUri?.split(".").pop() || "").toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  };

  // 프로필 사진 선택 및 업로드
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setDialog({ open:true, kind:'message', title:'권한 필요', message:'사진 접근 권한이 필요합니다.' });
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (picked.canceled) return;

      const asset = picked.assets[0];
      const fileUri = asset.uri;
      const fileName = fileUri.split("/").pop() || "profile.jpg";
      const info = await FileSystem.getInfoAsync(fileUri);

      if (!info.exists || info.isDirectory) {
        setDialog({ open:true, kind:'negative', title:'오류', message:'파일을 찾을 수 없습니다.' });
        return;
      }

      const size = typeof (info as any).size === "number" ? (info as any).size : 0;
      const contentType = guessMime(fileName);

      if (size <= 0) {
        setDialog({ open:true, kind:'negative', title:'오류', message:'파일 크기를 확인할 수 없습니다.' });
        return;
      }
      if (size > 5 * 1024 * 1024) {
        setDialog({ open:true, kind:'message', title:'용량 초과', message:'최대 5MB까지 업로드할 수 있습니다.' });
        return;
      }

      setUploading(true);

      // Presign 요청
      const { data } = await client.post("/v1/files/presign/profile", {
        fileName,
        contentType,
        size,
      });

      const signedUrl =
        data?.upload_url ?? data?.signed_url ?? data?.signedUrl ?? data?.uploadUrl;
      const downloadUrl =
        data?.download_url ?? data?.public_url ?? data?.downloadUrl ?? data?.publicUrl;

      if (!signedUrl || !downloadUrl) {
        setDialog({ open:true, kind:'negative', title:'오류', message:'업로드 URL 발급에 실패했습니다.' });
        return;
      }

      // S3 업로드
      const resUpload = await FileSystem.uploadAsync(signedUrl, fileUri, {
        httpMethod: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(size),
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      if (!(resUpload.status === 200 || resUpload.status === 204)) {
        throw new Error(`S3 업로드 실패: ${resUpload.status}`);
      }

      setProfileImageUrl(downloadUrl);
      setDialog({ open:true, kind:'positive', title:'완료', message:'프로필 사진이 업로드되었습니다.' });
    } catch (e: any) {
      console.warn(e);
      setDialog({ open:true, kind:'negative', title:'오류', message: e?.message || '이미지 업로드에 실패했습니다.' });
    } finally {
      setUploading(false);
    }
  }, []);

  // 단계별 유효성 검사
  const canProceed = () => {
    if (step === 0) return true; // 프로필 사진 선택(선택사항)
    if (step === 1) return nickname.trim().length >= 2 && !nicknameError && !nicknameChecking;
    if (step === 2) return residence.trim().length > 0;
    if (step === 3) return ageGroup !== null;
    if (step === 4) return gender !== null;
    if (step === 5) {
      const goal = parseFloat(weeklyGoal);
      return !isNaN(goal) && goal >= 0.1 && goal <= 999.99;
    }
    return false;
  };

  // 다음 단계로
  const handleNext = () => {
    if (!canProceed()) return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(step + 1);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // 이전 단계로
  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep(step - 1);
  };

  // 온보딩 완료
  const handleComplete = async () => {
    if (!canProceed()) return;

    try {
      setSaving(true);

      console.log('[ONBOARDING] Starting submission...');
      console.log('[ONBOARDING] Form data:', {
        nickname: nickname.trim(),
        residence: residence.trim(),
        age_group: ageGroup,
        gender: gender,
        weekly_goal_distance: parseFloat(weeklyGoal),
      });

      await submitOnboarding({
        nickname: nickname.trim(),
        residence: residence.trim(),
        age_group: ageGroup!,
        gender: gender!,
        weekly_goal_distance: parseFloat(weeklyGoal),
        profile_Image_Url: profileImageUrl || undefined,
      });

      setDialog({ open:true, kind:'positive', title:'환영합니다!', message:'Way to Earth에 오신 것을 환영합니다.' });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'LiveRunningScreen' } }] });
    } catch (e: any) {
      console.warn(e);
      setDialog({ open:true, kind:'negative', title:'오류', message: e?.response?.data?.message || '온보딩 완료에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  // 렌더링 함수들
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[styles.progressDot, i <= step && styles.progressDotActive]}
        />
      ))}
    </View>
  );

  const renderStep0 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>프로필 사진을 설정해주세요</Text>
      <Text style={styles.stepSubtitle}>나중에 변경할 수 있어요</Text>

      <TouchableOpacity
        style={styles.profileImageContainer}
        onPress={handlePickImage}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="large" color="#4A90E2" />
        ) : profileImageUrl ? (
          <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Ionicons name="camera" size={48} color="#ccc" />
            <Text style={styles.profileImageText}>사진 선택</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={uploading}
      >
        <Text style={styles.primaryButtonText}>
          {profileImageUrl ? "다음" : "건너뛰기"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep1 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>닉네임을 입력해주세요</Text>
      <Text style={styles.stepSubtitle}>2-20자 이내로 입력해주세요</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, nicknameError && styles.inputError]}
          placeholder="닉네임"
          value={nickname}
          onChangeText={setNickname}
          maxLength={20}
          autoFocus
        />
        {nicknameChecking && (
          <ActivityIndicator
            size="small"
            color="#4A90E2"
            style={styles.inputIcon}
          />
        )}
        {!nicknameChecking && nickname.length >= 2 && !nicknameError && (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color="#4CAF50"
            style={styles.inputIcon}
          />
        )}
      </View>

      {nicknameError && <Text style={styles.errorText}>{nicknameError}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canProceed()}
      >
        <Text style={styles.primaryButtonText}>다음</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>거주지를 알려주세요</Text>
      <Text style={styles.stepSubtitle}>같은 지역 러너들과 함께해요</Text>

      <TextInput
        style={styles.input}
        placeholder="예: 서울특별시 강남구"
        value={residence}
        onChangeText={setResidence}
        maxLength={100}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canProceed()}
      >
        <Text style={styles.primaryButtonText}>다음</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>연령대를 선택해주세요</Text>
      <Text style={styles.stepSubtitle}>통계 및 추천에 활용됩니다</Text>

      <View style={styles.optionsGrid}>
        {AGE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionCard,
              ageGroup === option.value && styles.optionCardSelected,
            ]}
            onPress={() => setAgeGroup(option.value)}
          >
            <Text
              style={[
                styles.optionText,
                ageGroup === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canProceed()}
      >
        <Text style={styles.primaryButtonText}>다음</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep4 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>성별을 선택해주세요</Text>
      <Text style={styles.stepSubtitle}>통계 및 추천에 활용됩니다</Text>

      <View style={styles.genderContainer}>
        {GENDER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.genderCard,
              gender === option.value && styles.genderCardSelected,
            ]}
            onPress={() => setGender(option.value)}
          >
            <Ionicons
              name={option.icon as any}
              size={48}
              color={gender === option.value ? "#4A90E2" : "#ccc"}
            />
            <Text
              style={[
                styles.genderText,
                gender === option.value && styles.genderTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleNext}
        disabled={!canProceed()}
      >
        <Text style={styles.primaryButtonText}>다음</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep5 = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.stepTitle}>주간 목표 거리를 설정해주세요</Text>
      <Text style={styles.stepSubtitle}>일주일 동안 달리고 싶은 거리(km)</Text>

      <View style={styles.goalInputContainer}>
        <TextInput
          style={styles.goalInput}
          placeholder="0"
          value={weeklyGoal}
          onChangeText={(text) => {
            // 숫자와 소수점만 허용
            const filtered = text.replace(/[^0-9.]/g, "");
            // 소수점이 두 개 이상이면 제거
            const parts = filtered.split(".");
            if (parts.length > 2) {
              setWeeklyGoal(parts[0] + "." + parts.slice(1).join(""));
            } else {
              setWeeklyGoal(filtered);
            }
          }}
          keyboardType="decimal-pad"
          autoFocus
        />
        <Text style={styles.goalUnit}>km</Text>
      </View>

      <View style={styles.presetGoalsContainer}>
        {[5, 10, 15, 20, 30, 42].map((goal) => (
          <TouchableOpacity
            key={goal}
            style={styles.presetGoalChip}
            onPress={() => setWeeklyGoal(String(goal))}
          >
            <Text style={styles.presetGoalText}>{goal}km</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !canProceed() && styles.buttonDisabled]}
        onPress={handleComplete}
        disabled={!canProceed() || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>완료</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {dialog.open && dialog.kind === 'positive' && (
        <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'negative' && (
        <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'message' && (
        <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 설정</Text>
        <View style={styles.backButton} />
      </View>

      {renderProgressBar()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: "#4A90E2",
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  stepContainer: {
    minHeight: 400,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 32,
    textAlign: "center",
  },
  profileImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: "center",
    marginBottom: 32,
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  profileImageText: {
    marginTop: 8,
    fontSize: 14,
    color: "#999",
  },
  inputContainer: {
    position: "relative",
    marginBottom: 16,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  inputError: {
    borderColor: "#f44336",
  },
  inputIcon: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  errorText: {
    color: "#f44336",
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
    paddingLeft: 16,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  optionCard: {
    width: (width - 72) / 2,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    backgroundColor: "#E3F2FD",
    borderColor: "#4A90E2",
  },
  optionText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#4A90E2",
    fontWeight: "700",
  },
  genderContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 32,
  },
  genderCard: {
    width: (width - 96) / 3,
    paddingVertical: 24,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  genderCardSelected: {
    backgroundColor: "#E3F2FD",
    borderColor: "#4A90E2",
  },
  genderText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  genderTextSelected: {
    color: "#4A90E2",
    fontWeight: "700",
  },
  goalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  goalInput: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    minWidth: 120,
    borderBottomWidth: 3,
    borderBottomColor: "#4A90E2",
    paddingVertical: 8,
  },
  goalUnit: {
    fontSize: 32,
    fontWeight: "600",
    color: "#888",
    marginLeft: 8,
  },
  presetGoalsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 32,
    gap: 8,
  },
  presetGoalChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 4,
    marginVertical: 4,
  },
  presetGoalText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  primaryButton: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#4A90E2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
});
