// utils/api/userJourneys.ts
// 서버 연동: Swagger 참고 (/v1/journeys/{journeyId}/start, /v1/journey-progress/user/{userId})
import type { JourneyId, UserJourneyState } from "@types/journey";
import { client } from "@utils/api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProgressResponse = {
  progressM: number; // meters
  lastLandmarkOrder: number;
  nextLandmarkDistM: number; // meters (0 if unknown)
  percent: number; // 0~100
  todayRunM: number; // meters (today)
  message: string;
};

export type UserJourneyProgressSummary = {
  journeyId: number;
  progressId?: string | number | null;
  progressM: number;
  percent: number;
  lastLandmarkOrder?: number;
  todayRunM?: number;
  runningTogether?: number; // 함께 뛰는 러너 수
};

const progressKey = (userId: string, journeyId: JourneyId) => `@journey_progress_id:${userId}:${journeyId}`;

async function saveProgressId(userId: string, journeyId: JourneyId, progressId: string | number | null | undefined) {
  try {
    if (progressId == null) return;
    await AsyncStorage.setItem(progressKey(userId, journeyId), String(progressId));
  } catch {}
}

async function removeProgressId(userId: string, journeyId: JourneyId) {
  try {
    await AsyncStorage.removeItem(progressKey(userId, journeyId));
  } catch {}
}

async function loadProgressId(userId: string, journeyId: JourneyId): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(progressKey(userId, journeyId))) || null;
  } catch { return null; }
}

export async function start(
  _userId: string,
  _journeyId: JourneyId
): Promise<UserJourneyState> {
  try {
    const uid = Number(_userId);
    const jid = Number(_journeyId as any);
    console.log('[JOURNEY][start] POST /v1/journeys/{id}/start', { journeyId: _journeyId, userId: _userId });
    // 일부 서버는 body로 userId를 요구할 수 있어 body+query 동시 전송
    const res = await client.post(
      `/v1/journeys/${jid}/start`,
      { userId: uid },
      { params: { userId: uid } }
    );
    const d: any = res?.data ?? {};
    const pid = d?.progressId ?? d?.id ?? d?.data?.progressId ?? d?.data?.id;
    if (pid != null) {
      console.log('[JOURNEY][start] got progressId:', pid);
      await saveProgressId(_userId, _journeyId, pid);
    }
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    console.warn('[JOURNEY][start] failed', { status, body });
    // 409(이미 시작)는 허용, 그 외 오류는 상위에서 중단 판단하도록 throw
    if (status === 409) {
      // ok: 이미 시작됨
    } else {
      throw e;
    }
  }
  const now = new Date().toISOString();
  return {
    userId: _userId,
    journeyId: _journeyId,
    progressM: 0,
    lastLandmarkOrder: 0,
    runsCount: 0,
    startedAt: now,
    completedAt: null,
  };
}

export async function getState(
  _userId: string,
  _journeyId: JourneyId,
  _totalM: number,
  _nextLandmarkDistM: number
): Promise<ProgressResponse> {
  const uid = Number(_userId);
  const jid = Number(_journeyId as any);

  // 0) 먼저 byUser로 이 여정의 progressId를 확정 (있으면 그 pid만 사용)
  console.log('[JOURNEY][getState] byUser', { uid, jid });
  let byUserItem: any = null;
  try {
    // 우선 단일 조회 엔드포인트 시도 (권장)
    const one = await client.get(`/v1/journey-progress/user/${uid}/journey/${jid}`);
    const rawOne: any = one.data?.data ?? one.data ?? null;
    const rawOneJid = rawOne?.journeyId ?? rawOne?.journey?.id;
    if (rawOne && (rawOneJid == null || String(rawOneJid) === String(jid))) {
      byUserItem = rawOne;
    }
  } catch {}
  if (!byUserItem) {
    try {
      // 구버전 목록 엔드포인트 (필터 실패 가능성 있으므로 클라이언트에서 엄격 필터)
      const resUser = await client.get(`/v1/journey-progress/user/${uid}`, { params: { journeyId: jid } });
      const rawUser: any = resUser.data?.data ?? resUser.data ?? {};
      const arrUser: any[] = Array.isArray(rawUser) ? rawUser : Array.isArray(rawUser?.content) ? rawUser.content : [];
      byUserItem = arrUser.find((x: any) => String(x?.journeyId ?? x?.journey?.id) === String(jid))
        || (String(rawUser?.journeyId ?? rawUser?.journey?.id ?? '') === String(jid) ? rawUser : null);
    } catch {}
  }

  // progressId 캐시를 로드하되, byUser 결과로 반드시 검증(없으면 캐시 무시)
  let cachedPid = await loadProgressId(_userId, _journeyId).catch(() => null);
  const pidFromUser = byUserItem?.progressId ?? byUserItem?.id ?? null;
  if (cachedPid && pidFromUser && String(cachedPid) !== String(pidFromUser)) {
    console.warn('[JOURNEY][getState] cachedPid != pidFromUser; clearing cache', { uid, jid, cachedPid, pidFromUser });
    await removeProgressId(_userId, _journeyId);
    cachedPid = null;
  }
  // byUser가 해당 여정의 진행을 찾지 못하면 캐시 사용 금지(타 여정 오염 방지)
  if (!pidFromUser && cachedPid) {
    console.warn('[JOURNEY][getState] no pidFromUser; try verify cachedPid byId', { uid, jid, cachedPid });
    try {
      const byId = await client.get(`/v1/journey-progress/${cachedPid}`);
      const d: any = byId.data?.data ?? byId.data ?? {};
      const dJourneyId = d?.journeyId ?? d?.journey?.id;
      if (dJourneyId != null && String(dJourneyId) === String(jid)) {
        // verified: return using byId snapshot
        const progressM = d.currentDistanceKm != null ? Number(d.currentDistanceKm) * 1000 : Number(d.progressM ?? 0);
        const percent = d.progressPercent != null ? Number(d.progressPercent) : (_totalM > 0 ? (progressM / _totalM) * 100 : 0);
        const nextKm = d.nextLandmark?.distanceFromStart ?? d.nextLandmark?.distanceKm;
        const nextLandmarkDistM = nextKm != null ? Number(nextKm) * 1000 : 0;
        const progressId = d.progressId ?? d.id;
        if (progressId != null) await saveProgressId(_userId, _journeyId, progressId);
        console.log('[JOURNEY][getState] use cachedPid byId verified', { uid, jid, cachedPid });
        return {
          progressM,
          lastLandmarkOrder: Number(d.lastLandmarkOrder ?? 0),
          nextLandmarkDistM,
          percent,
          todayRunM: Number(d.todayRunM ?? 0),
          message: d.message ?? '',
        };
      }
      // mismatch or cannot verify → drop cached
      console.warn('[JOURNEY][getState] cachedPid verify failed; clearing cache', { uid, jid, cachedPid, dJourneyId });
      await removeProgressId(_userId, _journeyId);
      cachedPid = null;
    } catch (e) {
      console.warn('[JOURNEY][getState] cachedPid verify error; clearing cache', { uid, jid, cachedPid });
      await removeProgressId(_userId, _journeyId);
      cachedPid = null;
    }
  }
  if (!cachedPid && pidFromUser) {
    await saveProgressId(_userId, _journeyId, pidFromUser);
    cachedPid = String(pidFromUser);
  }

  // 0-1) progressId가 확정되었으면 byId로 정밀 조회
  if (cachedPid) {
    try {
      console.log('[JOURNEY][getState] byId', { uid, jid, progressId: cachedPid });
      const byId = await client.get(`/v1/journey-progress/${cachedPid}`);
      const d: any = byId.data?.data ?? byId.data ?? {};
      const dJourneyId = d?.journeyId ?? d?.journey?.id;
      if (dJourneyId != null && String(dJourneyId) !== String(jid)) {
        console.warn('[JOURNEY][getState] progressId mismatch byId; clearing cache', { uid, jid, cachedPid, dJourneyId });
        await removeProgressId(_userId, _journeyId);
        throw new Error('PID_MISMATCH');
      }
      // 단일항목 후보로 온 경우(byUserItem.__needsVerify)에는 byId로 journeyId 검증이 통과한 것이므로 신뢰
      const progressM = d.currentDistanceKm != null ? Number(d.currentDistanceKm) * 1000 : Number(d.progressM ?? 0);
      const percent = d.progressPercent != null ? Number(d.progressPercent) : (_totalM > 0 ? (progressM / _totalM) * 100 : 0);
      const nextLmKm = d.nextLandmark?.distanceFromStart ?? d.nextLandmark?.distanceKm;
      const nextLandmarkDistM = nextLmKm != null ? Number(nextLmKm) * 1000 : 0;
      const progressId = d.progressId ?? d.id;
      if (progressId != null) await saveProgressId(_userId, _journeyId, progressId);
      return {
        progressM,
        lastLandmarkOrder: Number(d.lastLandmarkOrder ?? 0),
        nextLandmarkDistM,
        percent,
        todayRunM: Number(d.todayRunM ?? 0),
        message: d.message ?? '',
      };
    } catch {
      // fall through to using byUserItem (if present)
    }
  }

  // 1) 사용자별 목록에서 현 여정만 선택
  // 1) 앞서 가져온 byUserItem 사용(없으면 not_found)
  let item: any = byUserItem;
  // 보조2: 쿼리 엔드포인트 시도
  if (!item) {
    try {
      console.log('[JOURNEY][getState] byQuery', { uid, jid });
      const q = await client.get(`/v1/journey-progress`, { params: { userId: uid, journeyId: jid } });
      const qd: any = q.data?.data ?? q.data ?? {};
      const qa: any[] = Array.isArray(qd) ? qd : Array.isArray(qd?.content) ? qd.content : [];
      const found = qa.find((x: any) => String(x?.journeyId ?? x?.journey?.id) === String(jid))
        || (Object.keys(qd).length ? (String(qd?.journeyId ?? qd?.journey?.id ?? '') === String(jid) ? qd : null) : null);
      item = found ?? null;
    } catch {}
  }
  if (!item) {
    // 매칭되는 여정 진행이 없다 → 0 값으로 반환(저장/캐시 금지)
    console.warn('[JOURNEY][getState] not_found', { uid, jid });
    return {
      progressM: 0,
      lastLandmarkOrder: 0,
      nextLandmarkDistM: _nextLandmarkDistM,
      percent: 0,
      todayRunM: 0,
      message: 'not_found',
    };
  }
  const progressId = item?.progressId ?? item?.id ?? item?.progress_id;
  if (progressId != null) {
    console.log('[JOURNEY][getState] save progressId', { uid, jid, progressId });
    await saveProgressId(_userId, _journeyId, progressId);
  }
  let progressM = item?.currentDistanceKm != null
    ? Number(item.currentDistanceKm) * 1000
    : Number(item?.progressM ?? item?.progressMeters ?? item?.progress ?? 0);
  let lastOrder = Number(item?.lastLandmarkOrder ?? item?.last_order ?? 0);
  let today = Number(item?.todayRunM ?? item?.todayMeters ?? 0);
  let percent = item?.progressPercent != null
    ? Number(item.progressPercent)
    : Number(item?.percent ?? item?.progressPercentage ?? (_totalM > 0 ? (progressM / _totalM) * 100 : 0));
  // nextLandmark가 목록에 있을 수도 있음
  let nextLmKm2 = item?.nextLandmark?.distanceFromStart ?? item?.nextLandmark?.distanceKm;
  let nextLandmarkDistM = nextLmKm2 != null ? Number(nextLmKm2) * 1000 : _nextLandmarkDistM;

  // 2) progressId가 있고 서버가 percent를 제공하면 정밀값으로 보정
  if (progressId != null) {
    try {
      const byId = await client.get(`/v1/journey-progress/${progressId}`);
      const d: any = byId.data?.data ?? byId.data ?? {};
      if (d.progressPercent != null) percent = Number(d.progressPercent);
      if (d.currentDistanceKm != null) progressM = Number(d.currentDistanceKm) * 1000;
      if (d.lastLandmarkOrder != null) lastOrder = Number(d.lastLandmarkOrder);
      const nextKm = d.nextLandmark?.distanceFromStart ?? d.nextLandmark?.distanceKm;
      if (nextKm != null) nextLandmarkDistM = Number(nextKm) * 1000;
    } catch {}
  }
  return {
    progressM,
    lastLandmarkOrder: lastOrder,
    nextLandmarkDistM,
    percent,
    todayRunM: today,
    // Prefer message from the most recent source; fallback to empty
    message: (item && (item.message ?? item.msg)) ?? "",
  };
}

/**
 * 사용자의 모든 여정 진행 목록 조회 후 간단 요약으로 반환합니다.
 * GET /v1/journey-progress/user/{userId}
 */
export async function listUserProgress(_userId: string): Promise<UserJourneyProgressSummary[]> {
  const uid = Number(_userId);
  try {
    const res = await client.get(`/v1/journey-progress/user/${uid}`);
    const raw: any = res.data?.data ?? res.data ?? [];
    const arr: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.content)
      ? raw.content
      : (Object.keys(raw).length ? [raw] : []);
    return arr
      .map((x: any) => {
        const jid = x?.journeyId ?? x?.journey?.id;
        if (jid == null) return null;
        const progressM = x?.currentDistanceKm != null ? Number(x.currentDistanceKm) * 1000 : Number(x?.progressM ?? x?.progressMeters ?? 0);
        const percent = x?.progressPercent != null ? Number(x.progressPercent) : Number(x?.percent ?? 0);
        const progressId = x?.progressId ?? x?.id ?? null;
        return {
          journeyId: Number(jid),
          progressId,
          progressM,
          percent,
          lastLandmarkOrder: Number(x?.lastLandmarkOrder ?? 0),
          todayRunM: Number(x?.todayRunM ?? 0),
          runningTogether: Number(x?.runningTogether ?? 0), // 함께 뛰는 러너 수
        } as UserJourneyProgressSummary;
      })
      .filter(Boolean) as UserJourneyProgressSummary[];
  } catch (e) {
    console.warn('[JOURNEY][listUserProgress] failed', e);
    return [];
  }
}

export async function progress(
  _userId: string,
  _journeyId: JourneyId,
  _totalM: number,
  _deltaM: number
): Promise<ProgressResponse> {
  try {
    const uid = Number(_userId);
    const jid = Number(_journeyId as any);
    // 1) 저장된 progressId 로드
    let pid = await loadProgressId(_userId, _journeyId);
    // 2) 없으면 단일 엔드포인트로 조회 후 저장 (우선)
    if (!pid) {
      try {
        const one = await client.get(`/v1/journey-progress/user/${uid}/journey/${jid}`);
        const d: any = one.data?.data ?? one.data ?? null;
        const j = d?.journeyId ?? d?.journey?.id;
        if (d && (j == null || String(j) === String(jid))) {
          pid = String(d?.progressId ?? d?.id ?? '');
          if (pid) await saveProgressId(_userId, _journeyId, pid);
        }
      } catch {}
    }
    // 2b) 구버전 목록 엔드포인트로 조회 후 저장
    if (!pid) {
      try {
        const res = await client.get(`/v1/journey-progress/user/${uid}`, { params: { journeyId: jid } });
        const raw: any = res.data?.data ?? res.data ?? [];
        const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.content) ? raw.content : [];
        const item: any = list.find((x: any) => String(x?.journeyId ?? x?.journey?.id) === String(jid));
        pid = item ? String(item?.progressId ?? item?.id ?? '') : '';
        if (pid) await saveProgressId(_userId, _journeyId, pid);
      } catch (e) {
        console.warn('[JOURNEY][progress] resolve progressId failed');
      }
    }

    if (!pid) {
      // 현재 여정에 해당하는 진행이 없으면 서버 업데이트 금지(다른 여정 오염 방지)
      console.warn('[JOURNEY][progress] no progress for this journey; skip server update');
      const progressM = 0;
      const percent = 0;
      return { progressM, lastLandmarkOrder: 0, nextLandmarkDistM: 0, percent, todayRunM: 0, message: 'not_found' };
    }

    // 3) 서버 업데이트
    const body: any = {
      sessionId: `journey-${_journeyId}-${Date.now()}`,
      distanceKm: Math.max(0, _deltaM / 1000),
      // currentLocation 등 추가 가능
    };
    console.log('[JOURNEY][progress] PUT /v1/journey-progress/{id}', { pid, distanceKm: body.distanceKm });
    const { data } = await client.put(`/v1/journey-progress/${pid}`, body);
    const r: any = data?.data ?? data ?? {};
    const progressM = Number(r.progressM ?? r.progressMeters ?? r.progress ?? 0);
    const lastOrder = Number(r.lastLandmarkOrder ?? r.last_order ?? 0);
    const percent = Number(r.percent ?? r.progressPercent ?? (_totalM > 0 ? (progressM / _totalM) * 100 : 0));
    const today = Number(r.todayRunM ?? r.todayMeters ?? _deltaM);
    return {
      progressM,
      lastLandmarkOrder: lastOrder,
      nextLandmarkDistM: 0,
      percent,
      todayRunM: today,
      message: r.message ?? '',
    };
  } catch (e) {
    console.error('[JOURNEY][progress] failed:', e);
    throw e;
  }
}
