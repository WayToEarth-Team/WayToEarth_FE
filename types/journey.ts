// types/journey.ts
// 여정(코스) 도메인 타입 정의 (목/실서버 공통 사용)

export type JourneyId = string;
export type LandmarkOrder = number;

export type JourneyCategory =
  | "nature"
  | "city"
  | "mountain"
  | "coast"
  | "custom";
export type JourneyDifficulty = "beginner" | "intermediate" | "advanced";

export interface Journey {
  id: JourneyId;
  title: string;
  category: JourneyCategory;
  difficulty: JourneyDifficulty;
  totalKm: number;
  highlights: string[];
  coverImage?: string;
  stampsRequired?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface Landmark {
  id: string;
  journeyId: JourneyId;
  order: LandmarkOrder;
  name: string;
  desc?: string;
  image?: string;
  pos: LatLngPoint; // 원본 좌표
  anchor: LatLngPoint; // 도로 스냅/앵커 좌표(경로 강제용)
  radiusM: number; // 체크인 반경
}

export interface Segment {
  id: string;
  journeyId: JourneyId;
  orderFrom: LandmarkOrder;
  orderTo: LandmarkOrder;
  distanceM: number;
  polylineEncoded?: string;
  elevationGainM?: number;
}

export interface JourneyStats {
  journeyId: JourneyId;
  finishers: number;
  avgRating: number; // 0~5
  totalCheckins: number;
  lastAggregatedAt?: string;
}

export interface UserJourneyState {
  userId: string;
  journeyId: JourneyId;
  progressM: number;
  lastLandmarkOrder: LandmarkOrder;
  runsCount: number;
  startedAt: string;
  completedAt?: string | null;
}

export interface Stamp {
  id: string;
  journeyId: JourneyId;
  landmarkId: string;
  userId: string;
  mood?: string;
  rating?: number; // 1~5
  text?: string;
  photos?: string[];
  likes?: number;
  reports?: number;
  createdAt: string;
}
