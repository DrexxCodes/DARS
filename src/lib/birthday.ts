import { MAX_AGE_YEARS, MIN_AGE_YEARS } from "@/constants/birthday";
import type { DobCheck, DobParts } from "@/types/birthday";

/** Pure helpers shared by the sheet (client) and the API route (server). */

export const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when the user document carries a well-formed `dateOfBirth` (the field NPS uses too). */
export const hasBirthday = (u?: { dateOfBirth?: unknown } | null): boolean =>
  typeof u?.dateOfBirth === "string" && DOB_PATTERN.test(u.dateOfBirth);

const pad = (n: number | string) => String(n).padStart(2, "0");
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days in a 1-based month. With no year, February allows 29 so a leap-day birthday stays selectable. */
export function daysInMonth(month: number, year?: number): number {
  if (month === 2) return year ? (isLeap(year) ? 29 : 28) : 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Newest-first list of birth years the age window allows. */
export function yearOptions(now = new Date()): number[] {
  const newest = now.getUTCFullYear() - MIN_AGE_YEARS;
  return Array.from({ length: MAX_AGE_YEARS - MIN_AGE_YEARS + 1 }, (_, i) => newest - i);
}

export const isComplete = (p: DobParts) => !!p.day && !!p.month && !!p.year;

export const toDobString = (p: DobParts): string => `${p.year}-${pad(p.month)}-${pad(p.day)}`;

/** Validates a YYYY-MM-DD string: a real calendar date and an age inside the allowed window. */
export function checkDob(dob: string, now = new Date()): DobCheck {
  if (!DOB_PATTERN.test(dob)) return { ok: false, message: "Choose your day, month and year." };
  const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { ok: false, message: "That date doesn't exist. Check the day and month." };
  }
  const nowM = now.getUTCMonth() + 1;
  const age = now.getUTCFullYear() - y - (nowM < m || (nowM === m && now.getUTCDate() < d) ? 1 : 0);
  if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) return { ok: false, message: "Enter a valid date of birth." };
  return { ok: true, dob };
}

/**
 * Where the NPS birthday cron looks for people to wish: DOB/{MM}/days/{DD}/students/{uid}.
 * DARS writes the same index so DARS-only students get the birthday email too.
 */
export const dobIndexPath = (dob: string, uid: string) => `DOB/${dob.slice(5, 7)}/days/${dob.slice(8, 10)}/students/${uid}`;
