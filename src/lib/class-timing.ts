import { CLASS_DEFAULTS, CLASS_LIMITS } from "@/constants/class";

export type TimeUnit = "min" | "hr";

export const toMinutes = (value: number, unit: TimeUnit): number => Math.round(unit === "hr" ? value * 60 : value);

/** 120 -> "2 hr", 90 -> "1 hr 30 min", 45 -> "45 min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} hr ${m} min`;
  return h ? `${h} hr` : `${m} min`;
}

export function cleanClassName(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, CLASS_LIMITS.NAME_MAX) : "";
}

export type TimingResult =
  | { ok: true; durationMinutes: number; lateAfterMinutes: number }
  | { ok: false; error: string };

/**
 * Validates a class's length and its "on time until" window. Missing values fall back to the defaults, so older
 * clients that only send an action keep working. Late can equal the duration (nobody is ever late) but not exceed it.
 */
export function parseClassTiming(durationInput: unknown, lateInput: unknown): TimingResult {
  const durationMinutes = durationInput === undefined || durationInput === null ? CLASS_DEFAULTS.DURATION_MIN : Number(durationInput);
  if (!Number.isFinite(durationMinutes) || !Number.isInteger(durationMinutes)) return { ok: false, error: "Enter a valid class duration." };
  if (durationMinutes < CLASS_LIMITS.MIN_DURATION_MIN) return { ok: false, error: `A class must run at least ${CLASS_LIMITS.MIN_DURATION_MIN} minutes.` };
  if (durationMinutes > CLASS_LIMITS.MAX_DURATION_MIN) return { ok: false, error: `A class can run at most ${CLASS_LIMITS.MAX_DURATION_MIN / 60} hours.` };

  // No late value sent: keep the old 90 min, but never past the end of a shorter class.
  const lateAfterMinutes =
    lateInput === undefined || lateInput === null ? Math.min(CLASS_DEFAULTS.LATE_AFTER_MIN, durationMinutes) : Number(lateInput);
  if (!Number.isFinite(lateAfterMinutes) || !Number.isInteger(lateAfterMinutes) || lateAfterMinutes < 1) {
    return { ok: false, error: "Enter a valid late cut-off of at least 1 minute." };
  }
  if (lateAfterMinutes > durationMinutes) return { ok: false, error: "The late cut-off can't be longer than the class itself." };

  return { ok: true, durationMinutes, lateAfterMinutes };
}
