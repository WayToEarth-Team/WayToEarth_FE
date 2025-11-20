// utils/api/aiFeedback.ts
import { client } from "@utils/api/client";

/**
 * AI 피드백 응답 타입
 */
export type AIFeedback = {
  feedbackId: number;
  runningRecordId: number;
  feedbackContent: string;
  createdAt: string;
  modelName: string;
};

/**
 * AI 분석 생성 (POST)
 * 새로운 AI 분석을 생성합니다. (2-5초 소요)
 *
 * @param runningRecordId 분석할 러닝 기록 ID
 * @returns AI 피드백 데이터
 *
 * @throws 완료되지 않은 러닝 기록인 경우
 * @throws 최소 5회 이상의 완료된 러닝 기록이 필요한 경우
 * @throws 일일 분석 횟수 초과 (10회)
 * @throws 이미 분석된 기록인 경우 (409)
 */
export async function createAIFeedback(
  runningRecordId: number
): Promise<AIFeedback> {
  console.log("[API] AI 피드백 생성 요청:", { runningRecordId });

  const { data } = await client.post(
    `/v1/running/analysis/${runningRecordId}`
  );

  console.log("[API] AI 피드백 생성 응답:", data);
  return data as AIFeedback;
}

/**
 * AI 분석 조회 (GET)
 * 이미 생성된 AI 분석을 조회합니다. (캐싱, 100-300ms 소요)
 *
 * @param runningRecordId 조회할 러닝 기록 ID
 * @returns AI 피드백 데이터
 *
 * @throws AI 분석 기록이 없는 경우 (404)
 * @throws 권한이 없는 경우
 */
export async function getAIFeedback(
  runningRecordId: number
): Promise<AIFeedback> {
  console.log("[API] AI 피드백 조회 요청:", { runningRecordId });

  const { data } = await client.get(
    `/v1/running/analysis/${runningRecordId}`
  );

  console.log("[API] AI 피드백 조회 응답:", data);
  return data as AIFeedback;
}

/**
 * 전체 AI 분석 조회 (최근 러닝 기록 기반)
 * 최근 러닝 기록을 가져와서 해당 기록에 대한 AI 분석 수행
 *
 * @param onLoading 로딩 상태 변경 콜백 (POST 시 2-5초 소요)
 * @returns AI 피드백 데이터
 */
export async function getOrCreateOverallFeedback(
  onLoading?: (loading: boolean) => void
): Promise<{ feedback: AIFeedback; wasCreated: boolean }> {
  try {
    // 먼저 최근 러닝 기록 조회
    console.log("[API] 최근 러닝 기록 조회");
    const response = await client.get(`/v1/running/records`, {
      params: { limit: 1, offset: 0 },
    });

    console.log("[API] 응답 데이터:", response.data);

    // 응답 구조 확인 - data가 배열일 수도, 객체일 수도 있음
    let records = Array.isArray(response.data) ? response.data : response.data?.records || response.data?.data || [];

    if (!records || records.length === 0) {
      throw new Error("러닝 기록이 없습니다.");
    }

    const latestRecordId = records[0].id;
    console.log("[API] 최근 러닝 기록 ID:", latestRecordId);

    // 해당 기록에 대한 AI 피드백 조회 시도
    try {
      const feedback = await getAIFeedback(latestRecordId);
      return { feedback, wasCreated: false };
    } catch (error: any) {
      // 404인 경우 새로 생성
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        onLoading?.(true);
        try {
          const feedback = await createAIFeedback(latestRecordId);
          return { feedback, wasCreated: true };
        } finally {
          onLoading?.(false);
        }
      }
      throw error;
    }
  } catch (error: any) {
    throw error;
  }
}

/**
 * AI 피드백 조회 또는 생성 (개별 레코드용 - deprecated)
 * @deprecated 이제 getOrCreateOverallFeedback 사용
 */
export async function getOrCreateAIFeedback(
  runningRecordId: number,
  onLoading?: (loading: boolean) => void
): Promise<{ feedback: AIFeedback; wasCreated: boolean }> {
  try {
    // 먼저 조회 시도 (캐싱, 빠름)
    const feedback = await getAIFeedback(runningRecordId);
    return { feedback, wasCreated: false };
  } catch (error: any) {
    // 404인 경우 새로 생성
    if (error?.response?.status === 404) {
      onLoading?.(true);
      try {
        const feedback = await createAIFeedback(runningRecordId);
        return { feedback, wasCreated: true };
      } finally {
        onLoading?.(false);
      }
    }
    // 다른 에러는 그대로 throw
    throw error;
  }
}

/**
 * API 에러를 사용자 친화적 메시지로 변환
 */
export function getFriendlyErrorMessage(
  error: any,
  completedCount?: number
): string {
  const message = error?.response?.data?.error?.message || "";

  if (message.includes("완료된 러닝 기록만")) {
    return "러닝 완료 후 분석할 수 있어요!";
  }

  if (message.includes("최소 5회 이상")) {
    if (completedCount !== undefined && completedCount < 5) {
      return `${5 - completedCount}회 더 러닝하면 AI 분석을 이용할 수 있어요!`;
    }
    return "AI 분석을 위해서는 최소 5회 이상의 완료된 러닝 기록이 필요해요!";
  }

  if (message.includes("일일 AI 분석 횟수를 초과")) {
    return "오늘의 AI 분석을 모두 사용했어요. 내일 다시 만나요! 🌙";
  }

  if (message.includes("이미 AI 분석이 완료된")) {
    return "이미 분석된 기록이에요. 잠시 후 다시 시도해주세요.";
  }

  if (message.includes("찾을 수 없거나 접근 권한이 없습니다")) {
    return "러닝 기록을 찾을 수 없어요.";
  }

  return "AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.";
}
