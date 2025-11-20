// running/utils/geo.ts
import type { LatLng } from "@types/types.ts";
export type AnyPoint = {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

const toDeg = (p: AnyPoint) => ({
  lat: p.latitude ?? p.lat!,
  lng: p.longitude ?? p.lng!,
});

export const distanceKm = (a: AnyPoint, b: AnyPoint) => {
  const A = toDeg(a),
    B = toDeg(b);
  const R = 6371; // km
  const dLat = ((B.lat - A.lat) * Math.PI) / 180;
  const dLng = ((B.lng - A.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((A.lat * Math.PI) / 180) *
      Math.cos((B.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s)); // km
};
