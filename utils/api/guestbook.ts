// utils/api/guestbook.ts
import { client } from "@utils/api/client";
import type {
  GuestbookCreateRequest,
  GuestbookResponse,
  PageableResponse,
  LandmarkStatistics,
} from "@types/guestbook";

/**
 * 방명록 작성
 *
 * @param userId 사용자 ID
 * @param request 방명록 작성 요청 데이터
 * @returns 생성된 방명록 정보
 *
 * @throws 사용자를 찾을 수 없음 (400)
 * @throws 랜드마크를 찾을 수 없음 (400)
 * @throws 메시지가 비어있거나 500자 초과 (400)
 */
export async function createGuestbook(
  userId: number,
  request: GuestbookCreateRequest
): Promise<GuestbookResponse> {
  console.log("[API] 방명록 작성 요청:", { userId, request });

  const { data } = await client.post<GuestbookResponse>(
    `/v1/guestbook`,
    request,
    {
      params: { userId },
    }
  );

  console.log("[API] 방명록 작성 응답:", data);
  return data;
}

/**
 * 랜드마크별 방명록 목록 조회 (공개 방명록만)
 *
 * @param landmarkId 랜드마크 ID
 * @param page 페이지 번호 (0부터 시작)
 * @param size 페이지당 항목 수 (기본값: 20)
 * @returns 페이징된 방명록 목록
 */
export async function getGuestbooksByLandmark(
  landmarkId: number,
  page: number = 0,
  size: number = 20
): Promise<PageableResponse<GuestbookResponse>> {
  console.log("[API] 랜드마크별 방명록 조회:", { landmarkId, page, size });

  const { data } = await client.get<PageableResponse<GuestbookResponse>>(
    `/v1/guestbook/landmarks/${landmarkId}`,
    {
      params: {
        page,
        size,
        sort: "createdAt,desc", // 최신순 정렬
      },
    }
  );

  console.log("[API] 랜드마크별 방명록 응답:", data);
  return data;
}

/**
 * 내 방명록 목록 조회 (공개/비공개 모두 포함)
 *
 * @param userId 사용자 ID
 * @returns 방명록 목록 (페이징 없음)
 */
export async function getMyGuestbooks(
  userId: number
): Promise<GuestbookResponse[]> {
  console.log("[API] 내 방명록 조회:", { userId });

  const { data } = await client.get<GuestbookResponse[]>(
    `/v1/guestbook/users/${userId}`
  );

  console.log("[API] 내 방명록 응답:", data);
  return data;
}

/**
 * 최근 방명록 목록 조회 (전체 공개 방명록)
 *
 * @param page 페이지 번호 (0부터 시작)
 * @param size 페이지당 항목 수 (기본값: 20)
 * @returns 페이징된 최근 방명록 목록
 */
export async function getRecentGuestbooks(
  page: number = 0,
  size: number = 20
): Promise<PageableResponse<GuestbookResponse>> {
  console.log("[API] 최근 방명록 조회:", { page, size });

  const { data } = await client.get<PageableResponse<GuestbookResponse>>(
    `/v1/guestbook/recent`,
    {
      params: {
        page,
        size,
        sort: "createdAt,desc", // 최신순 정렬
      },
    }
  );

  console.log("[API] 최근 방명록 응답:", data);
  return data;
}

/**
 * 랜드마크 통계 조회
 *
 * @param landmarkId 랜드마크 ID
 * @returns 방명록 수 및 방문자 수
 */
export async function getLandmarkStatistics(
  landmarkId: number
): Promise<LandmarkStatistics> {
  console.log("[API] 랜드마크 통계 조회:", { landmarkId });

  const { data } = await client.get<LandmarkStatistics>(
    `/v1/guestbook/landmarks/${landmarkId}/statistics`
  );

  console.log("[API] 랜드마크 통계 응답:", data);
  return data;
}

/**
 * 방명록 에러를 사용자 친화적 메시지로 변환
 */
export function getGuestbookErrorMessage(error: any): string {
  const message = error?.response?.data?.message || error?.message || "";

  if (message.includes("사용자를 찾을 수 없습니다")) {
    return "사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.";
  }

  if (message.includes("랜드마크를 찾을 수 없습니다")) {
    return "해당 랜드마크를 찾을 수 없습니다.";
  }

  if (message.includes("메시지는 필수입니다")) {
    return "메시지를 입력해주세요.";
  }

  if (message.includes("500자 이하")) {
    return "메시지는 500자 이하로 입력해주세요.";
  }

  if (message.includes("랜드마크 ID는 필수입니다")) {
    return "랜드마크를 선택해주세요.";
  }

  return "방명록 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
}

/**
 * 방명록 메시지 유효성 검사
 *
 * @param message 메시지
 * @returns 에러 메시지 (유효하면 null)
 */
export function validateGuestbookMessage(message: string): string | null {
  if (!message || message.trim().length === 0) {
    return "메시지를 입력해주세요.";
  }

  if (message.length > 500) {
    return "메시지는 500자 이하로 입력해주세요.";
  }

  return null; // 유효함
}
