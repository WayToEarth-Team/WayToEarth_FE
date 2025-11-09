// utils/api/users.ts
import { client } from "./client";
import type { UserInfo } from "../../types/types";

// 공통: 래퍼 응답 { success, data, ... } 언래핑 유틸
function unwrap<T = any>(resData: any): T {
  return (resData && resData.data != null ? resData.data : resData) as T;
}

/** 닉네임 중복확인: 서버 응답 포맷 차이를 흡수해 표준화 */
export async function checkNickname(rawNickname: string) {
  const nickname = (rawNickname ?? "").trim();

  if (!nickname) {
    return {
      available: false,
      isDuplicate: true,
      message: "닉네임을 입력하세요.",
    };
  }

  try {
    const { data } = await client.get("/v1/users/check-nickname", {
      params: { nickname },
    });

    const available =
      typeof data?.available === "boolean"
        ? data.available
        : !Boolean(data?.isDuplicate);

    return {
      available,
      isDuplicate: !available,
      message:
        data?.message ??
        (available ? "사용 가능" : "이미 사용 중인 닉네임입니다."),
    };
  } catch (e: any) {
    return {
      available: false,
      isDuplicate: true,
      message:
        e?.response?.data?.message ??
        "닉네임 확인에 실패했습니다. 잠시 후 다시 시도하세요.",
    };
  }
}

/** 온보딩 입력 형태(화면에서 받는 값) */
export type OnboardingInput = {
  nickname: string;
  residence: string;
  age_group: string; // "10대" | "20대" | "30대" | "40대" | "50대" | "60대 이상"
  gender: string; // "남성" | "여성" | "기타"
  height?: number; // 키(cm): 100 ~ 250
  weight?: number; // 몸무게(kg): 30 ~ 200
  weekly_goal_distance: number; // Swagger: 최소 0.1
  profile_Image_Url?: string;
  profile_image_key?: string;
};

/** 숫자 문자열에서 숫자만 추출: "주 10km" → 10 */
function extractNumber(input: string | number) {
  if (typeof input === "number") return input;
  const s = String(input ?? "").trim();
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 회원가입/온보딩 제출: Swagger 스펙에 맞춘 필드 전송 */
export async function submitOnboarding(input: OnboardingInput) {
  const payload = {
    nickname: (input.nickname ?? "").trim(),
    residence: (input.residence ?? "").trim(),
    age_group: input.age_group,
    gender: input.gender,
    height: input.height,
    weight: input.weight,
    weekly_goal_distance: Math.max(
      0.1,
      extractNumber(input.weekly_goal_distance)
    ),
    profile_Image_Url: input.profile_Image_Url?.trim() || undefined,
  };

  console.log('[ONBOARDING] Payload:', JSON.stringify(payload, null, 2));
  console.log('[ONBOARDING] Calling POST /v1/auth/onboarding...');

  const res = await client.post("/v1/auth/onboarding", payload);

  console.log('[ONBOARDING] Response received:', res.data);

  return unwrap(res.data);
}

/** 화면의 UserInfo → Swagger 온보딩 입력으로 매핑 */
export async function registerUser(userInfo: UserInfo) {
  return submitOnboarding({
    nickname: userInfo.nickname,
    residence: userInfo.location,
    weekly_goal_distance: extractNumber(userInfo.runningDistance),
  });
}

// 내 프로필 상세
export type UserProfile = {
  id: number;
  nickname: string;
  profile_image_url?: string | null;
  residence?: string | null;
  age_group?: string | null;
  gender?: string | null;
  height?: number | null; // 키(cm)
  weight?: number | null; // 몸무게(kg)
  weekly_goal_distance?: number | null;
  total_distance?: number | null;
  total_running_count?: number | null;
  created_at?: string;
  profile_image_key?: string | null;
  role?: string | null; // 'USER' | 'ADMIN'
};

export async function getMyProfile(): Promise<UserProfile> {
  const res = await client.get("/v1/users/me");
  const profile = unwrap<UserProfile>(res.data);
  console.log('[USERS] My profile:', JSON.stringify(profile, null, 2));
  return profile;
}

// 특정 사용자 프로필 조회
export async function getUserProfile(userId: string | number): Promise<UserProfile> {
  const res = await client.get(`/v1/users/${userId}/profile`);
  const profile = unwrap<UserProfile>(res.data);
  console.log('[USERS] User profile for', userId, ':', JSON.stringify(profile, null, 2));
  return profile;
}

// 내 대시보드/요약
export type UserSummary = {
  completion_rate: number; // 0~1
  emblem_count: number;
  total_distance: number;
  total_running_count: number;
};

export async function getMySummary(): Promise<UserSummary> {
  const res = await client.get("/v1/users/me/summary");
  return unwrap<UserSummary>(res.data);
}

// 회원 탈퇴
export async function deleteMyAccount(): Promise<void> {
  console.log('[USERS] Deleting account...');
  await client.delete("/v1/users/me");
  console.log('[USERS] Account deleted successfully');
}
