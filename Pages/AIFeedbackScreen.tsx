import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getOrCreateOverallFeedback,
  getFriendlyErrorMessage,
  AIFeedback,
} from "../utils/api/aiFeedback";
import { client } from "../utils/api/client";
import Markdown from "../components/Common/Markdown";

type AIFeedbackScreenProps = {
  route?: {
    params?: {
      completedCount?: number;
      latestRecordId?: number;
    };
  };
  navigation?: any;
};

const AIFeedbackScreen: React.FC<AIFeedbackScreenProps> = ({
  route,
  navigation,
}) => {
  const completedCount = route?.params?.completedCount ?? 0;
  const latestRecordId = route?.params?.latestRecordId;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasCreated, setWasCreated] = useState(false);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      if (latestRecordId) {
        console.log("[AI Feedback] 전달받은 레코드 ID 사용:", latestRecordId);
        try {
          const feedback = await client
            .get(`/v1/running/analysis/${latestRecordId}`)
            .then((res) => res.data);
          result = { feedback, wasCreated: false };
        } catch (err: any) {
          if (err?.response?.status === 404 || err?.response?.status === 400) {
            setLoading(true);
            const feedback = await client
              .post(`/v1/running/analysis/${latestRecordId}`)
              .then((res) => res.data);
            result = { feedback, wasCreated: true };
          } else {
            throw err;
          }
        }
      } else {
        result = await getOrCreateOverallFeedback((loading) => {
          setLoading(loading);
        });
      }

      setFeedback(result.feedback);
      setWasCreated(result.wasCreated);
    } catch (err: any) {
      console.error("[AI Feedback Error]", err);
      const friendlyMessage = getFriendlyErrorMessage(err, completedCount);
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    loadFeedback();
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.centerContainer}>
          <LinearGradient
            colors={["#6366F1", "#8B5CF6"]}
            style={s.loadingGradient}
          >
            <View style={s.loadingIconBox}>
              <Ionicons name="analytics" size={48} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <ActivityIndicator
            size="large"
            color="#6366F1"
            style={s.loadingSpinner}
          />
          <Text style={s.loadingTitle}>AI가 분석 중이에요</Text>
          <Text style={s.loadingSubtitle}>
            러닝 기록을 꼼꼼히 분석하고 있어요
          </Text>
          <View style={s.loadingDots}>
            <View style={s.dot} />
            <View style={[s.dot, s.dotDelay1]} />
            <View style={[s.dot, s.dotDelay2]} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={["top"]} style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.centerContainer}>
          <View style={s.errorIconBox}>
            <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          </View>
          <Text style={s.errorTitle}>분석을 완료하지 못했어요</Text>
          <Text style={s.errorMessage}>{error}</Text>
          <TouchableOpacity style={s.retryButton} onPress={retry}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={s.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.cancelButton}
            onPress={() => navigation?.goBack?.()}
          >
            <Text style={s.cancelButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={s.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={s.headerTitleBox}>
          <Ionicons name="sparkles" size={20} color="#6366F1" />
          <Text style={s.headerTitle}>AI 코치</Text>
        </View>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(120, insets.bottom + 140) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* New Badge */}
        {wasCreated && (
          <View style={s.newBadgeContainer}>
            <LinearGradient
              colors={["#6366F1", "#8B5CF6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.newBadge}
            >
              <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              <Text style={s.newBadgeText}>새로운 분석</Text>
            </LinearGradient>
          </View>
        )}

        {/* Main Feedback Card */}
        <View style={s.feedbackCard}>
          <View style={s.aiHeader}>
            <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={s.aiIconBox}>
              <Ionicons name="flash" size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={s.aiHeaderText}>
              <Text style={s.aiTitle}>AI 코치의 분석</Text>
              <Text style={s.aiSubtitle}>당신의 러닝 패턴 분석 결과</Text>
            </View>
          </View>

          <View style={s.feedbackContent}>
            {!!feedback?.feedbackContent && (
              <Markdown content={feedback.feedbackContent} />
            )}
          </View>

          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
              <Text style={s.metaText}>
                {new Date(feedback?.createdAt ?? "").toLocaleDateString(
                  "ko-KR",
                  {
                    month: "long",
                    day: "numeric",
                  }
                )}
              </Text>
            </View>
            <View style={s.metaDivider} />
            <View style={s.metaItem}>
              <Ionicons name="cube-outline" size={14} color="#94A3B8" />
              <Text style={s.metaText}>{feedback?.modelName}</Text>
            </View>
          </View>
        </View>

        {/* Goal Section */}
        <View style={s.sectionHeader}>
          <Ionicons name="flag" size={20} color="#0F172A" />
          <Text style={s.sectionTitle}>다음 목표</Text>
        </View>
        <View style={s.goalCard}>
          <LinearGradient
            colors={["#FEF3C7", "#FDE68A"]}
            style={s.goalGradient}
          >
            <Ionicons name="trophy" size={32} color="#F59E0B" />
          </LinearGradient>
          <Text style={s.goalText}>
            꾸준히 성장하고 있으니 이 페이스를 유지하세요!
          </Text>
        </View>

        {/* Tips Section */}
        <View style={s.sectionHeader}>
          <Ionicons name="bulb" size={20} color="#0F172A" />
          <Text style={s.sectionTitle}>알아두세요</Text>
        </View>
        <View style={s.tipsContainer}>
          <View style={s.tipCard}>
            <View style={s.tipIconBox}>
              <Ionicons name="bar-chart" size={20} color="#6366F1" />
            </View>
            <Text style={s.tipText}>
              최근 10개의 러닝 기록을 분석하여 성장 패턴을 파악해요
            </Text>
          </View>
          <View style={s.tipCard}>
            <View style={s.tipIconBox}>
              <Ionicons name="time" size={20} color="#6366F1" />
            </View>
            <Text style={s.tipText}>
              하루 최대 10번까지 AI 분석을 받을 수 있어요
            </Text>
          </View>
          <View style={s.tipCard}>
            <View style={s.tipIconBox}>
              <Ionicons name="trending-up" size={20} color="#6366F1" />
            </View>
            <Text style={s.tipText}>
              꾸준히 기록하면 더 정확한 분석을 받을 수 있어요
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View
        style={[
          s.bottomContainer,
          { paddingBottom: Math.max(20, insets.bottom + 12) },
        ]}
      >
        <TouchableOpacity
          style={s.closeButton}
          onPress={() => navigation?.goBack?.()}
        >
          <Text style={s.closeButtonText}>확인</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerRight: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Loading
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loadingIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  loadingSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 24,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
  },
  dotDelay1: {
    opacity: 0.6,
  },
  dotDelay2: {
    opacity: 0.3,
  },

  // Error
  errorIconBox: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 12,
    minWidth: 200,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: 200,
  },
  cancelButtonText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  // New Badge
  newBadgeContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Feedback Card
  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  aiIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  aiHeaderText: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  aiSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  feedbackContent: {
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: "400",
    color: "#334155",
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E2E8F0",
  },
  metaText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },

  // Goal Card
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  goalGradient: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  goalText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 22,
  },

  // Tips
  tipsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  tipIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "500",
  },

  // Bottom
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  closeButton: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});

export default AIFeedbackScreen;
