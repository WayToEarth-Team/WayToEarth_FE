import { client } from "./client";
import { getMyProfile } from "./users";

export type Crew = {
  id: string;
  name: string;
  description: string;
  progress: string; // UI 표기용: "{currentMembers}/{maxMembers}"
  imageUrl?: string | null;
  role?: CrewRole; // OWNER를 ADMIN으로 매핑하여 UI 호환
};

// Local mock storage keys removed – using only real API

export type CrewRole = "ADMIN" | "MEMBER";
export type CrewMember = {
  id: string;
  nickname: string;
  role: CrewRole;
  profileImage?: string | null;
  lastRunningDate?: string | null;
};
export type CrewApplicant = {
  id: string;
  nickname: string;
  userId?: string;
  profileImage?: string | null;
};
// Public crew detail (for viewing a specific crew from the list)
export type CrewPublicDetail = {
  id: string;
  name: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  profileImageUrl?: string | null;
  isActive: boolean;
  ownerId: string;
  ownerNickname: string;
  createdAt: string;
  updatedAt: string;
};

export async function getCrewById(crewId: string): Promise<CrewPublicDetail> {
  const { data } = await client.get(`/v1/crews/${crewId}`);
  const d = data as any;
  return {
    id: String(d.id),
    name: String(d.name ?? ""),
    description: String(d.description ?? ""),
    maxMembers: Number(d.maxMembers ?? 0),
    currentMembers: Number(d.currentMembers ?? 0),
    profileImageUrl: d.profileImageUrl ?? null,
    isActive: Boolean(d.isActive ?? true),
    ownerId: String(d.ownerId ?? d.ownerUserId ?? d.owner?.id ?? ""),
    ownerNickname: String(d.ownerNickname ?? d.owner?.nickname ?? ""),
    createdAt: String(d.createdAt ?? ""),
    updatedAt: String(d.updatedAt ?? ""),
  };
}
export type CrewDetail = {
  crew: Crew;
  role: CrewRole;
  members: CrewMember[];
  pending: CrewApplicant[]; // 가입 신청 목록 (관리자 전용)
};

export async function getMyCrew(): Promise<Crew | null> {
  try {
    console.log('[CREWS][getMyCrew] start');
    // 1) 우선 단일 객체 응답 시도
    const myRes = await client.get("/v1/crews/my").catch((e) => ({ data: null, __err: e } as any));
    const d = myRes?.data as any;
    if (d && typeof d === 'object' && (d.id != null || d.crew?.id != null)) {
      const raw = d.crew ?? d;
      console.log('[CREWS][getMyCrew] got single object');
      return {
        id: String(raw.id),
        name: String(raw.name ?? "크루"),
        description: String(raw.description ?? ""),
        progress: `${raw.currentMembers ?? 0}/${raw.maxMembers ?? 0}`,
        imageUrl: raw.profileImageUrl ?? null,
      } as Crew;
    }

    // 2) 페이지 응답일 경우 첫 항목 사용
    const first = d?.content?.[0];
    if (first) {
      console.log('[CREWS][getMyCrew] got page content[0]');
      return {
        id: String(first.id),
        name: String(first.name ?? "크루"),
        description: String(first.description ?? ""),
        progress: `${first.currentMembers ?? 0}/${first.maxMembers ?? 0}`,
        imageUrl: first.profileImageUrl ?? null,
      } as Crew;
    }

    // 3) 멤버십 폴백: ACTIVE만 인정
    const membershipsRes = await client.get("/v1/crews/memberships/my").catch((e) => ({ data: [], __err: e } as any));
    const memberships = (membershipsRes.data as any[]) || [];
    const active = memberships.find((m: any) => String(m?.status || '').toUpperCase() === 'ACTIVE');
    if (!active) {
      console.log('[CREWS][getMyCrew] no active membership');
      return null;
    }
    const crewId = String(active.crewId ?? active?.crew?.id ?? "");
    if (!crewId) return null;
    const { data: cd } = await client.get(`/v1/crews/${crewId}`);
    console.log('[CREWS][getMyCrew] loaded crew by id');
    return {
      id: String(cd.id),
      name: String(cd.name ?? "크루"),
      description: String(cd.description ?? ""),
      progress: `${cd.currentMembers ?? 0}/${cd.maxMembers ?? 0}`,
      imageUrl: cd.profileImageUrl ?? null,
    } as Crew;
  } catch (e) {
    console.warn('[CREWS][getMyCrew] failed:', e);
    return null;
  }
}

export async function getMyCrewDetail(): Promise<CrewDetail | null> {
  console.log('[CREWS][getMyCrewDetail] start');
  const my = await getMyCrew();
  if (!my) {
    console.log('[CREWS][getMyCrewDetail] no my crew');
    return null;
  }

  const [detailRes, membersRes, pendingRes, me, membershipsRes] = await Promise.all([
    client.get(`/v1/crews/${my.id}`).catch((e) => ({ data: {}, __err: e })),
    client.get(`/v1/crews/${my.id}/members`, { params: { page: 0, size: 100 } }).catch((e) => ({ data: { content: [] }, __err: e })),
    client.get(`/v1/crews/${my.id}/join-requests`, { params: { page: 0, size: 100 } }).catch((e) => ({ data: { content: [] }, __err: e })),
    getMyProfile().catch((e) => { console.warn('[CREWS][getMyCrewDetail] getMyProfile failed', e); return null as any; }),
    client.get(`/v1/crews/memberships/my`).catch((e) => ({ data: [], __err: e })),
  ]);

  const d = detailRes.data as any; // CrewDetailResponse (may be empty on failure)
  const membersPage = membersRes.data as any; // PageCrewMemberResponse
  const pendingPage = pendingRes.data as any; // PageJoinRequestResponse
  const memberships = membershipsRes.data as any[];

  // 멤버 데이터 샘플 로그 (API 응답 구조 확인용)
  if (membersPage?.content?.[0]) {
    console.log('[CREWS] Sample member data:', JSON.stringify(membersPage.content[0], null, 2));
  }

  // 안정적인 ID 선택: 상세가 비어있으면 my.id 사용
  const rawId = d?.id ?? (my as any)?.id;
  if (!rawId) {
    // 유효한 크루 식별자가 없으면 상세 구성 불가
    console.log('[CREWS][getMyCrewDetail] invalid crew id in detail response');
    return null;
  }

  const role: CrewRole = (() => {
    const myId = me?.id != null ? Number(me.id) : undefined;
    const list = membersPage?.content ?? [];
    const mine = list.find((m: any) => Number(m.userId) === myId);
    const isOwnerLike = (x: any) => Boolean(x?.isOwner || x?.owner || x?.isLeader || x?.role === "OWNER");
    if (mine && isOwnerLike(mine)) return "ADMIN";
    // 멤버십 폴백
    const ms = (memberships || []).find((m: any) => String(m?.crewId) === String(my.id));
    if (ms && isOwnerLike(ms)) return "ADMIN";
    // 상세 정보에 owner 식별자가 있을 수 있음
    const ownerHints = [d?.ownerUserId, d?.ownerId, d?.owner?.id, d?.owner?.userId].filter((v) => v != null);
    if (myId != null && ownerHints.some((v) => Number(v) === myId)) return "ADMIN";
    return "MEMBER";
  })();

  // 멤버 목록 폴백: /members가 비정상/불완전하면 /members/regular를 가져와 OWNER를 합성
  let membersList: any[] = Array.isArray(membersPage?.content)
    ? membersPage.content
    : [];
  console.log('[CREWS][getMyCrewDetail] Initial members from /members:', membersList.length);
  if (membersList.length <= 1) {
    console.log('[CREWS][getMyCrewDetail] Members <= 1, trying /members/regular fallback');
    try {
      const { data: reg } = await client.get(`/v1/crews/${my.id}/members/regular`, { params: { page: 0, size: 100 } });
      const regulars = Array.isArray(reg?.content) ? reg.content : Array.isArray(reg) ? reg : [];
      // OWNER 합성: 상세/기존 목록에서 소유자 식별
      const ownerId = [d?.ownerUserId, d?.ownerId, d?.owner?.id, d?.owner?.userId, membersList.find((m: any) => m?.isOwner)?.userId]
        .find((v) => v != null);
      const ownerNick = d?.ownerNickname || d?.owner?.nickname || membersList.find((m: any) => m?.isOwner)?.userNickname;
      const owner = ownerId
        ? [{ userId: Number(ownerId), userNickname: String(ownerNick ?? "크루장"), role: "OWNER", isOwner: true }]
        : [];
      // 중복 제거
      const merged = [...owner, ...regulars];
      const seen = new Set<string>();
      membersList = merged.filter((m: any) => {
        const key = String(m.userId);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.log('[CREWS][getMyCrewDetail] After fallback, members count:', membersList.length);
    } catch (e) {
      console.warn('[CREWS][getMyCrewDetail] Fallback failed:', e);
    }
  }

  console.log('[CREWS][getMyCrewDetail] Final members count before mapping:', membersList.length);

  const mapped: CrewDetail = {
    crew: {
      id: String(rawId),
      name: String(d?.name ?? "크루"),
      description: String(d?.description ?? ""),
      progress: `${d?.currentMembers ?? 0}/${d?.maxMembers ?? 0}`,
      imageUrl: d?.profileImageUrl ?? null,
      role,
    },
    role,
    members: (membersList ?? []).map((m: any) => ({
      id: String(m.userId),
      nickname: String(m.userNickname ?? ""),
      role: m.isOwner || m.role === "OWNER" ? "ADMIN" : "MEMBER",
      profileImage: m.userProfileImage ?? m.user_profile_image_url ?? m.profile_image_url ?? null,
      lastRunningDate: m.lastRunningDate ?? null,
    })),
    pending: (pendingPage?.content ?? [])
      .filter((p: any) => String(p?.status ?? '').toUpperCase() === 'PENDING')
      .map((p: any) => ({
        id: String(p.id),
        nickname: String(p.userNickname ?? p.applicantNickname ?? ''),
        userId: p.userId != null ? String(p.userId) : (p.applicantId != null ? String(p.applicantId) : undefined),
        profileImage: p.userProfileImage ?? p.applicantProfileImage ?? p.profile_image_url ?? p.user_profile_image_url ?? null,
      })),
  };
  console.log('[CREWS][getMyCrewDetail] mapped detail ok');
  return mapped;
}

export async function listCrews(
  query?: string,
  page: number = 0,
  size: number = 20
): Promise<{ crews: Crew[]; hasMore: boolean }> {
  // 실제 API: 목록 또는 검색
  if (query && query.trim().length > 0) {
    const { data } = await client.get("/v1/crews/search", {
      params: { keyword: query.trim(), page, size },
    });
    const pageData = data as any;
    const crews = (pageData?.content ?? []).map((c: any) => ({
      id: String(c.id),
      name: String(c.name ?? "크루"),
      description: String(c.description ?? ""),
      progress: `${c.currentMembers ?? 0}/${c.maxMembers ?? 0}`,
      imageUrl: c.profileImageUrl ?? null,
    })) as Crew[];
    const hasMore = !pageData?.last && crews.length === size;
    return { crews, hasMore };
  }
  const { data } = await client.get("/v1/crews", { params: { page, size } });
  const pageData = data as any;
  const crews = (pageData?.content ?? []).map((c: any) => ({
    id: String(c.id),
    name: String(c.name ?? "크루"),
    description: String(c.description ?? ""),
    progress: `${c.currentMembers ?? 0}/${c.maxMembers ?? 0}`,
    imageUrl: c.profileImageUrl ?? null,
  })) as Crew[];
  const hasMore = !pageData?.last && crews.length === size;
  return { crews, hasMore };
}

export async function createCrew(payload: {
  name: string;
  description?: string;
}): Promise<Crew> {
  const { data } = await client.post("/v1/crews", payload);
  const c = data as any;
  return {
    id: String(c.id),
    name: String(c.name ?? payload.name),
    description: String(c.description ?? payload.description ?? ""),
    progress: `${c.currentMembers ?? 1}/${c.maxMembers ?? 1}`,
    imageUrl: c.profileImageUrl ?? null,
    role: "ADMIN",
  } as Crew;
}

export type JoinResult = { pending: true; crewId: string } | Crew;

export async function joinCrew(crew: Crew, message?: string): Promise<JoinResult> {
  // 실제 API: 가입 신청 생성 → 기본적으로 PENDING
  const payload = (message && message.trim().length > 0) ? { message: message.trim() } : {};
  await client.post(`/v1/crews/${crew.id}/join-requests`, payload as any);
  return { pending: true, crewId: crew.id } as JoinResult;
}

export async function removeMember(crewId: string, userId: string): Promise<void> {
  await client.delete(`/v1/crews/${crewId}/members/${userId}`);
}

export async function approveRequest(requestId: string, note?: string): Promise<void> {
  try {
    await client.post(`/v1/crews/join-requests/${requestId}/approve`, { note: note ?? "" });
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 500 || status === 409) {
      // 서버가 이미 처리된 요청에 500/409를 내는 경우가 있어, 상위에서 재조회로 흡수
      const err = new Error('APPROVE_RETRY');
      (err as any).code = 'APPROVE_RETRY';
      throw err;
    }
    throw e;
  }
}

export async function rejectRequest(requestId: string, note?: string): Promise<void> {
  await client.post(`/v1/crews/join-requests/${requestId}/reject`, { note: note ?? "" });
}

// 권한 부여/회수 및 폐쇄
// 서버 스펙상 OWNER/MEMBER만 존재 → 승격은 소유권 이양으로 처리
export async function promoteMember(crewId: string, userId: string): Promise<void> {
  // 승격 = 소유권 이양 (UI 호환 목적)
  await client.post(`/v1/crews/${crewId}/transfer-ownership`, { newOwnerId: Number(userId) });
}

export async function demoteMember(crewId: string, userId: string): Promise<void> {
  await client.patch(`/v1/crews/${crewId}/members/${userId}/role`, { newRole: "MEMBER" });
}

export async function closeCrew(crewId: string): Promise<void> {
  await client.delete(`/v1/crews/${crewId}`);
}

// 멤버 탈퇴
export async function leaveCrew(crewId: string): Promise<void> {
  await client.delete(`/v1/crews/${crewId}/members/leave`);
}

// 운영진 권한 이임(소유권 이전)
export async function transferOwnership(crewId: string, userId: string): Promise<void> {
  await client.post(`/v1/crews/${crewId}/transfer-ownership`, { newOwnerId: Number(userId) });
}

// presigned URL에서 기본 URL만 추출 (쿼리 파라미터 제거)
function stripPresignedParams(url: string | null): string | null {
  if (!url) return null;
  try {
    // presigned URL이면 쿼리 파라미터 전부 제거
    const baseUrl = url.split('?')[0];
    return baseUrl;
  } catch {
    return url;
  }
}

// 크루 멤버 목록 전체 조회 (페이징 없음)
export async function getAllCrewMembers(crewId: string): Promise<CrewMember[]> {
  const { data } = await client.get(`/v1/crews/${crewId}/members/all`);
  console.log('[CREWS][getAllCrewMembers] raw response:', JSON.stringify(data, null, 2));
  const members = (Array.isArray(data) ? data : []).map((m: any) => {
    console.log('[CREWS][getAllCrewMembers] member:', JSON.stringify(m, null, 2));
    const rawUrl = m.userProfileImage ?? null;
    const cleanUrl = stripPresignedParams(rawUrl);
    console.log('[CREWS][getAllCrewMembers] URL transform:', rawUrl, '->', cleanUrl);
    return {
      id: String(m.userId),
      nickname: String(m.userNickname ?? ""),
      role: m.isOwner || m.role === "OWNER" ? "ADMIN" : "MEMBER",
      profileImage: cleanUrl,
      lastRunningDate: m.lastRunningDate ?? null,
    };
  }) as CrewMember[];
  console.log('[CREWS][getAllCrewMembers] mapped members:', JSON.stringify(members, null, 2));
  return members;
}

// 특정 크루 멤버 조회
export async function getCrewMember(crewId: string, userId: string): Promise<CrewMember> {
  const { data } = await client.get(`/v1/crews/${crewId}/members/${userId}`);
  const m = data as any;
  return {
    id: String(m.userId),
    nickname: String(m.userNickname ?? ""),
    role: m.isOwner || m.role === "OWNER" ? "ADMIN" : "MEMBER",
    profileImage: m.userProfileImage ?? null,
    lastRunningDate: m.lastRunningDate ?? null,
  };
}

// 크루 멤버 목록 조회 (페이지네이션)
export async function getCrewMembers(
  crewId: string,
  page: number = 0,
  size: number = 20
): Promise<{ members: CrewMember[]; hasMore: boolean }> {
  const { data } = await client.get(`/v1/crews/${crewId}/members`, {
    params: { page, size },
  });
  const pageData = data as any;
  const members = (pageData?.content ?? []).map((m: any) => ({
    id: String(m.userId),
    nickname: String(m.userNickname ?? ""),
    role: m.isOwner || m.role === "OWNER" ? "ADMIN" : "MEMBER",
    profileImage: stripPresignedParams(
      m.userProfileImage ?? m.user_profile_image_url ?? m.profile_image_url ?? null
    ),
    lastRunningDate: m.lastRunningDate ?? null,
  })) as CrewMember[];
  const hasMore = !pageData?.last && members.length === size;
  return { members, hasMore };
}
