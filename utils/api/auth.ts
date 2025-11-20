// utils/api/auth.ts
import { client } from "@utils/api/client";
import { setTokens, clearTokens } from "@utils/auth/tokenManager";

type KakaoMe = {
  id: number;
  kakao_account?: { email?: string };
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
};

export type LoginResponse = {
  // 서버 실제 페이로드(언래핑 가정). 프로젝트 상황에 맞춰 유연하게 사용.
  userId?: number;
  jwtToken?: string; // 구버전 호환
  accessToken?: string; // 신버전 액세스 토큰
  refreshToken?: string; // 신버전 리프레시 토큰
  tokenType?: string; // "Bearer"
  isNewUser?: boolean;
  isOnboardingCompleted?: boolean;
};

export const kakaoLogin = async (code: string, redirectUri: string) => {
  const res = await client.post<LoginResponse>("/v1/auth/kakao", {
    code,
    redirectUri,
    isMobile: true,
  });
  return res.data; // client가 래퍼 언래핑
};

export const kakaoLoginWithSDK = async (accessToken: string) => {
  // 1) 카카오 user/me로 kakaoId 확보
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!meRes.ok) {
    const text = await meRes.text().catch(() => "");
    throw new Error(
      `Kakao user/me 요청 실패: ${meRes.status} ${meRes.statusText} ${text}`
    );
  }
  const me: KakaoMe = await meRes.json();
  const kakaoId = me?.id != null ? String(me.id) : "";
  if (!kakaoId) throw new Error("카카오 사용자 ID를 가져오지 못했습니다.");

  // 2) 서버 로그인 요청 (POST /v1/auth/kakao)
  // Swagger: KakaoLoginRequest requires { accessToken, kakaoId }
  const payload = {
    kakaoId,
    accessToken,
    isMobile: true,
  } as const;

  const res = await client.post<LoginResponse>("/v1/auth/kakao", payload);

  // 3) 토큰 픽업(언래핑 유/무 모두 커버)
  const body: any = res.data; // client가 언래핑했으면 페이로드, 아니면 래퍼
  const data = body?.data ?? body;

  const access = data?.accessToken ?? data?.jwtToken ?? data?.token;
  const refresh = data?.refreshToken;

  if (!access) {
    throw new Error(
      `서버에서 액세스 토큰을 받지 못했습니다. resp=${JSON.stringify(body)}`
    );
  }

  // Persist using secure strategy
  await setTokens(String(access), refresh ?? null);

  return {
    accessToken: access,
    refreshToken: refresh,
    isOnboardingCompleted: data?.isOnboardingCompleted ?? false,
    userId: data?.userId,
    isNewUser: data?.isNewUser,
  } as LoginResponse;
};

// 서버 로그아웃 (Authorization 필요)
export const logout = async () => {
  // 서버 세션 무효화만 담당. 토큰 삭제는 호출자가 순서 제어(FCM 비활성화 등) 후 수행.
  try { await client.post("/v1/auth/logout", {}); } catch {}
};
