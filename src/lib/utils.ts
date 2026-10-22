import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

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

// UNIZIK Political Science reg number: 20YY133XXX (full-time), 20YY134XXX (part-time), 20YY165XXX (Political Science Education, regular) or 20YY164XXX (Political Science Education, CEP)
export const REG_NUMBER_REGEX = /^20\d{2}(133|134|165|164)\d{3}$/;

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

export function isClassExpired(startTime: number): boolean {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  return Date.now() - startTime >= TWO_HOURS;
}

export function isLateAttendance(startTime: number): boolean {
  const NINETY_MIN = 90 * 60 * 1000;
  return Date.now() - startTime >= NINETY_MIN;
}

export function getRemainingTime(startTime: number): string {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const remaining = TWO_HOURS - (Date.now() - startTime);
  if (remaining <= 0) return "Ended";
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
