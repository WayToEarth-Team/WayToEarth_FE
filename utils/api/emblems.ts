// utils/api/emblems.ts
import { client } from "./client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Achievement, Summary } from "../../types/types";

export async function getEmblemSummary(): Promise<Summary> {
  const { data } = await client.get("/v1/emblems/me/summary");
  return data as Summary;
}

export async function getEmblemCatalog(params?: {
  filter?: "ALL" | "OWNED" | "UNOWNED";
  size?: number;
}) {
  const { data } = await client.get("/v1/emblems/catalog", {
    params: { filter: "ALL", size: 50, ...(params ?? {}) },
  });
  return data as Achievement[];
}

// Award an emblem by code, with flexible fallbacks for server variations.
// Returns whether a new emblem was awarded.
export async function awardEmblemByCode(code: string): Promise<{ awarded: boolean; data?: any }> {
  try {
    // Primary: POST body { code }
    const { data } = await client.post("/v1/emblems/award", { code });
    const d: any = data && (data.data ?? data);
    const awarded = Boolean(
      d?.awarded === true ||
      d?.newlyAwarded === true ||
      (typeof d?.awarded_count === 'number' && d.awarded_count > 0) ||
      (Array.isArray(d?.awarded_emblem_ids) && d.awarded_emblem_ids.length > 0)
    );
    if (awarded) {
      try {
        const raw = (await AsyncStorage.getItem('@owned_emblem_codes')) || '[]';
        const arr: string[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
        if (!arr.includes(code)) {
          arr.push(code);
          await AsyncStorage.setItem('@owned_emblem_codes', JSON.stringify(arr));
        }
      } catch {}
    }
    return { awarded, data: d };
  } catch (e1) {
    // Fallback: path param style
    try {
      const { data } = await client.post(`/v1/emblems/award/${encodeURIComponent(code)}`);
      const d: any = data && (data.data ?? data);
      const awarded = Boolean(
        d?.awarded === true ||
        d?.newlyAwarded === true ||
        (typeof d?.awarded_count === 'number' && d.awarded_count > 0) ||
        (Array.isArray(d?.awarded_emblem_ids) && d.awarded_emblem_ids.length > 0)
      );
      if (awarded) {
        try {
          const raw = (await AsyncStorage.getItem('@owned_emblem_codes')) || '[]';
          const arr: string[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
          if (!arr.includes(code)) {
            arr.push(code);
            await AsyncStorage.setItem('@owned_emblem_codes', JSON.stringify(arr));
          }
        } catch {}
      }
      return { awarded, data: d };
    } catch (e2) {
      return { awarded: false };
    }
  }
}
