// pace.ts

// 1) "분/㎞" 숫자(예: 5.5 == 5분30초) → m/s
export const paceToMps = (minPerKm: number) => {
  if (!isFinite(minPerKm) || minPerKm <= 0) return 0;
  // 소수 처리 안전하게: 전체 초 = 분/㎞ * 60
  const totalSecPerKm = Math.round(minPerKm * 60); // 5.5 -> 330초(=5:30)
  return 1000 / totalSecPerKm; // m/s
};

// 2) 초 → "M:SS"
export const fmtMMSS = (seconds: number) => {
  if (!isFinite(seconds) || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  // 59.6초 같은 반올림 경계 처리
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// 평균 페이스(초/㎞)
export const avgPaceSecPerKm = (distanceKm: number, elapsedSec: number) => {
  if (!isFinite(distanceKm) || distanceKm < 0.05) return Infinity;
  if (!isFinite(elapsedSec) || elapsedSec <= 0) return Infinity;
  const secPerKm = elapsedSec / distanceKm;
  // 닉런과 유사한 표기: 초 단위 반올림
  return Math.round(secPerKm);
};

// 라벨 변환
export const avgPaceLabel = (distanceKm: number, elapsedSec: number) => {
  const secPerKm = avgPaceSecPerKm(distanceKm, elapsedSec);
  return fmtMMSS(secPerKm); // 5:49 형식
};

/**
 * 칼로리 계산 (METs 기반)
 *
 * ⚠️ 백엔드와 동일한 계산 공식 사용 (CalorieCalculator.java 참조)
 *
 * METs 값 (속도 기준):
 * - 걷기 (< 6 km/h):      METs 3.5
 * - 조깅 (6 ~ 8 km/h):    METs 7.0
 * - 러닝 (8 ~ 10 km/h):   METs 9.0
 * - 빠른 러닝 (≥ 10 km/h): METs 11.0
 *
 * 칼로리(kcal) = 체중(kg) × METs × 시간(h) × 1.05
 *
 * @param distanceKm 달린 거리 (km)
 * @param elapsedSec 경과 시간 (초)
 * @param weightKg 체중 (kg), 기본값 65kg
 * @returns 소모 칼로리 (kcal)
 */
export const caloriesKcal = (
  distanceKm: number,
  elapsedSec: number = 0,
  weightKg = 65
): number => {
  // 유효성 검증
  if (!isFinite(distanceKm) || distanceKm <= 0) return 0;
  if (!isFinite(elapsedSec) || elapsedSec <= 0) return 0;
  if (!isFinite(weightKg) || weightKg <= 0) return 0;

  // 시간을 시간(hour) 단위로 변환
  const durationHours = elapsedSec / 3600.0;

  // 속도(km/h) 계산
  const speedKmh = distanceKm / durationHours;

  // 속도에 따른 METs 값 결정 (백엔드와 동일)
  let mets: number;
  if (speedKmh < 6.0) {
    mets = 3.5;  // 걷기
  } else if (speedKmh < 8.0) {
    mets = 7.0;  // 조깅
  } else if (speedKmh < 10.0) {
    mets = 9.0;  // 러닝
  } else {
    mets = 11.0; // 빠른 러닝
  }

  // 칼로리 계산: 체중(kg) × METs × 시간(h) × 1.05
  const calories = weightKg * mets * durationHours * 1.05;

  // 반올림하여 정수로 반환
  return Math.round(calories);
};
