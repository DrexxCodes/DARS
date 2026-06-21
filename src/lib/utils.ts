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

// UNIZIK Political Science reg number: 20YY133XXX or 20YY134XXX
export const REG_NUMBER_REGEX = /^20\d{2}(133|134)\d{3}$/;

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

export function getAttendanceColor(percentage: number): string {
  if (percentage >= 75) return "text-brand-600 dark:text-brand-400";
  if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function getAttendanceBg(percentage: number): string {
  if (percentage >= 75) return "bg-brand-500";
  if (percentage >= 50) return "bg-yellow-500";
  return "bg-red-500";
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
