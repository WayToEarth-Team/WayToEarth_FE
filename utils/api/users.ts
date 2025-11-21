// utils/api/users.ts
import { client } from "@utils/api/client";
import type { UserInfo } from "@types/types";

// unwrap helper: many APIs return { success, data, ... }
function unwrap<T = any>(resData: any): T {
  return (resData && resData.data != null ? resData.data : resData) as T;
}

// Check nickname availability
export async function checkNickname(rawNickname: string) {
  const nickname = (rawNickname ?? "").trim();

  if (!nickname) {
    return {
      available: false,
      isDuplicate: true,
      message: "Please enter a nickname.",
    };
  }

  try {
    const { data } = await client.get("/v1/users/check-nickname", {
      params: { nickname },
    });

    const available =
      typeof (data as any)?.available === "boolean"
        ? !!(data as any).available
        : !Boolean((data as any)?.isDuplicate);

    return {
      available,
      isDuplicate: !available,
      message:
        (typeof (data as any)?.message === "string"
          ? (data as any).message
          : available
          ? "Nickname available."
          : "Nickname already in use."),
    };
  } catch (e: any) {
    return {
      available: false,
      isDuplicate: true,
      message:
        (e?.response?.data?.message as string) ??
        "Failed to check nickname. Please try again.",
    };
  }
}

// Onboarding input (subset used by Register flow)
export type OnboardingInput = {
  nickname: string;
  residence: string;
  age_group: string; // e.g., "TWENTIES" (backend may map from display label)
  gender: string; // e.g., "MALE" | "FEMALE" | "OTHER"
  height?: number; // cm
  weight?: number; // kg
  weekly_goal_distance: number; // km
  profileImageUrl?: string;
  profile_image_key?: string;
};

// Extract number from string like "약 10km" -> 10
function extractNumber(input: string | number) {
  if (typeof input === "number") return input;
  const s = String(input ?? "").trim();
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Submit onboarding
export async function submitOnboarding(input: OnboardingInput) {
  const payload: any = {
    nickname: (input.nickname ?? "").trim(),
    residence: (input.residence ?? "").trim(),
    age_group: input.age_group,
    gender: input.gender,
    height: input.height,
    weight: input.weight,
    weekly_goal_distance: Math.max(0.1, extractNumber(input.weekly_goal_distance)),
    // send both variants to satisfy backend differences
    profileImageUrl: input.profileImageUrl?.trim() || undefined,
    profile_image_url: input.profileImageUrl?.trim() || undefined,
    profile_image_key: input.profile_image_key?.trim() || undefined,
  };

  console.log('[ONBOARDING] Payload:', JSON.stringify(payload, null, 2));
  console.log('[ONBOARDING] Calling POST /v1/auth/onboarding...');

  const res = await client.post("/v1/auth/onboarding", payload);

  console.log('[ONBOARDING] Response received:', res.data);

  return unwrap(res.data);
}

// Map from screen UserInfo to onboarding
export async function registerUser(userInfo: UserInfo) {
  return submitOnboarding({
    nickname: (userInfo as any).nickname,
    residence: (userInfo as any).location,
    // the minimal fields used in current flow
    age_group: (userInfo as any).age_group ?? "TWENTIES",
    gender: (userInfo as any).gender ?? "OTHER",
    weekly_goal_distance: extractNumber((userInfo as any).runningDistance),
  } as any);
}

// User profile detail
export type UserProfile = {
  id: number;
  nickname: string;
  profile_image_url?: string | null;
  residence?: string | null;
  age_group?: string | null;
  gender?: string | null;
  height?: number | null; // cm
  weight?: number | null; // kg
  weekly_goal_distance?: number | null;
  total_distance?: number | null;
  total_running_count?: number | null;
  created_at?: string;
  profile_image_key?: string | null;
  role?: string | null; // 'USER' | 'ADMIN'
  is_pace_coach_enabled?: boolean; // AI 페이스 코치 활성화 여부
};

export async function getMyProfile(): Promise<UserProfile> {
  const res = await client.get("/v1/users/me");
  const profile = unwrap<UserProfile>(res.data);
  if (__DEV__) console.log('[USERS] My profile:', JSON.stringify(profile, null, 2));
  return profile;
}

// Fetch specific user profile
export async function getUserProfile(userId: string | number): Promise<UserProfile> {
  const res = await client.get(`/v1/users/${userId}/profile`);
  const profile = unwrap<UserProfile>(res.data);
  console.log('[USERS] User profile for', userId, ':', JSON.stringify(profile, null, 2));
  return profile;
}

// User summary
export type UserSummary = {
  completion_rate: number; // 0..1
  emblem_count: number;
  total_distance: number;
  total_running_count: number;
};

export async function getMySummary(): Promise<UserSummary> {
  const res = await client.get("/v1/users/me/summary");
  return unwrap<UserSummary>(res.data);
}

// Delete my account
export async function deleteMyAccount(): Promise<void> {
  console.log('[USERS] Deleting account...');
  await client.delete("/v1/users/me");
  console.log('[USERS] Account deleted successfully');
}

// Update user settings
export async function updateUserSettings(settings: {
  is_pace_coach_enabled?: boolean;
}): Promise<void> {
  console.log('[USERS] Updating settings...', settings);
  // 일부 백엔드가 PATCH를 지원하지 않는 경우가 있어 PUT 우선, 실패 시 PATCH로 재시도
  try {
    const { data } = await client.put("/v1/users/me", settings);
    console.log('[USERS] Settings updated via PUT /me:', data);
    return;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status && status !== 405 && status !== 404) throw err;
    try {
      const { data } = await client.patch("/v1/users/me", settings);
      console.log('[USERS] Settings updated via PATCH /me:', data);
      return;
    } catch (err2) {
      console.error('[USERS] Settings update failed via PUT/PATCH /me:', err2);
      throw err2;
    }
  }
}
