import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { CLASS_DEFAULTS } from "@/constants/class";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEE, MMM d yyyy");
}

export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), "h:mm a");
}

// UNIZIK Political Science reg number: 20YY134XXX (regular), 20YY133XXX (CEP), 20YY174XXX (Political Science Education, regular) or 20YY173XXX (Political Science Education, CEP)
export const REG_NUMBER_REGEX = /^20\d{2}(133|134|173|174)\d{3}$/;

export function validateRegNumber(regNumber: string): boolean {
  return REG_NUMBER_REGEX.test(regNumber.trim().toUpperCase());
}

export function normalizeRegNumber(regNumber: string): string {
  return regNumber.trim().toUpperCase();
}

export function getAttendancePercentage(attended: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((attended / total) * 100);
}

export type AttendanceTier = "none" | "critical" | "low" | "normal" | "nerd";
export type AttendanceBadge = "slate" | "critical" | "orange" | "blue" | "green";

export interface AttendanceStatus {
  tier: AttendanceTier;
  label: string;
  badge: AttendanceBadge;
  text: string; // text colour classes
  bar: string; // progress-bar fill classes
  card: string; // card tint classes
  hex: string; // chart fill
}

/**
 * Single source of truth for attendance labels.
 *   no classes held yet (total = 0) -> "No classes yet" (never "low")
 *   < 20%  -> Critical
 *   < 50%  -> Low
 *   50-70% -> Normal
 *   > 70%  -> Nerd
 */
export function getAttendanceStatus(percentage: number, total: number): AttendanceStatus {
  if (!total || total <= 0) {
    return {
      tier: "none", label: "No classes yet", badge: "slate",
      text: "text-slate-500 dark:text-slate-400", bar: "bg-slate-300 dark:bg-slate-600",
      card: "bg-slate-100 dark:bg-slate-800", hex: "#94a3b8",
    };
  }
  if (percentage < 20) {
    return {
      tier: "critical", label: "Critical", badge: "critical",
      text: "text-red-600 dark:text-red-400", bar: "bg-red-600",
      card: "bg-red-50 dark:bg-red-950", hex: "#dc2626",
    };
  }
  if (percentage < 50) {
    return {
      tier: "low", label: "Low", badge: "orange",
      text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500",
      card: "bg-orange-50 dark:bg-orange-950", hex: "#f97316",
    };
  }
  if (percentage <= 70) {
    return {
      tier: "normal", label: "Normal", badge: "blue",
      text: "text-blue-600 dark:text-blue-400", bar: "bg-blue-500",
      card: "bg-blue-50 dark:bg-blue-950", hex: "#3b82f6",
    };
  }
  return {
    tier: "nerd", label: "Nerd 🤓", badge: "green",
    text: "text-brand-600 dark:text-brand-400", bar: "bg-brand-500",
    card: "bg-brand-50 dark:bg-brand-950", hex: "#16a34a",
  };
}

const DEFAULT_CLASS_MS = CLASS_DEFAULTS.DURATION_MIN * 60_000;
const DEFAULT_LATE_MS = CLASS_DEFAULTS.LATE_AFTER_MIN * 60_000;

/** When check-in closes. Uses the class's own end time; classes started before it was configurable fall back to 2 hours. */
function classEnd(startTime: number, endTime?: number | null): number {
  return typeof endTime === "number" && endTime > startTime ? endTime : startTime + DEFAULT_CLASS_MS;
}

export function isClassExpired(startTime: number, endTime?: number | null): boolean {
  return Date.now() >= classEnd(startTime, endTime);
}

/** Late once `lateAfterMinutes` have passed since the class started (90 when the class doesn't carry its own). */
export function isLateAttendance(startTime: number, lateAfterMinutes?: number | null): boolean {
  const lateMs = typeof lateAfterMinutes === "number" && lateAfterMinutes > 0 ? lateAfterMinutes * 60_000 : DEFAULT_LATE_MS;
  return Date.now() - startTime >= lateMs;
}

export function getRemainingTime(startTime: number, endTime?: number | null): string {
  const remaining = classEnd(startTime, endTime) - Date.now();
  if (remaining <= 0) return "Ended";
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  return hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
}
