// utils/datetime.ts
// Normalize various timestamp shapes (ISO, no timezone, epoch seconds/ms) to a proper Date.

export function normalizeTimestampToDate(input: any): Date {
  try {
    if (input == null) return new Date();
    // If it's already a Date
    if (input instanceof Date) return input as Date;

    // If it's a number or numeric string
    if (typeof input === 'number' || (/^\d+$/.test(String(input)))) {
      const n = typeof input === 'number' ? input : parseInt(String(input), 10);
      const ms = n < 1e11 ? n * 1000 : n; // seconds → ms (10/13 digits heuristic)
      return new Date(ms);
    }

    const s = String(input);
    // If ISO-like but without timezone ("YYYY-MM-DDTHH:mm:ss") → treat as LOCAL time
    const isoNoZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
    if (isoNoZone.test(s)) return new Date(s);

    // If space separated without timezone ("YYYY-MM-DD HH:mm:ss") → treat as LOCAL time
    const spaceNoZone = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
    if (spaceNoZone.test(s)) return new Date(s.replace(' ', 'T'));

    // Otherwise rely on Date parser; if invalid, fallback to now
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

export function formatTimeLocalHHmm(input: any) {
  const d = normalizeTimestampToDate(input);
  const h = d.getHours(); // local hours
  const m = d.getMinutes(); // local minutes
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
