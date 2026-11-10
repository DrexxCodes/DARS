import { createHash } from "crypto";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import type { DeviceSignals } from "@/types/device";

const SALT = process.env.DEVICE_HASH_SALT || "dars-device-salt";
const HEX_64 = /^[a-f0-9]{64}$/;
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

/** Claims stay until the class ends plus this, then Firestore TTL removes them. Kept a day for admin audits. */
const RETENTION_AFTER_CLASS_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CLASS_LENGTH_MS = 2 * 60 * 60 * 1000;

export const DEVICE_CONFLICT = {
  error: "Couldn't mark this attendance. Something looks sketchy.",
  code: "DEVICE_CONFLICT",
} as const;

export const SIGNALS_REQUIRED = {
  error: "Please refresh the app and try again.",
  code: "SIGNALS_REQUIRED",
} as const;

export function hash(value: string): string {
  return createHash("sha256").update(SALT).update(value).digest("hex").slice(0, 32);
}

/** First (client-most) address in x-forwarded-for; IPv6 is reduced to its /64 so privacy-rotated addresses still match. */
export function getClientIp(req: Request): string {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const ip = raw.replace(/^::ffff:/i, "");
  return ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
}

export function parseDeviceSignals(fingerprint: unknown, deviceId: unknown): DeviceSignals | null {
  if (typeof fingerprint !== "string" || !HEX_64.test(fingerprint)) return null;
  if (typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) return null;
  return { fingerprint, deviceId };
}

interface ClaimInput {
  courseId: string;
  classId: string;
  startTime: number;
  /** When the class ends. Missing on classes started before durations were configurable (2 h). */
  endTime?: number | null;
  regNumber: string;
  ip: string;
  fingerprint: string;
}

export interface DeviceClaims {
  refs: DocumentReference[];
  data: Record<string, unknown>;
}

/**
 * One deterministic claim doc per mark, under the class session (so different courses never collide):
 *   p_<fingerprint>_<ip>  same phone model on the same network already marked this class (other browser, incognito, installed app vs Safari)
 * Same IP alone is fine (hotspots/CGNAT), and same fingerprint alone is fine (identical phone models on different networks).
 * Deterministic IDs + create() make the check atomic with the attendance write.
 *
 * The old per-class browser-ID claim (`d_<deviceId>`) is gone: a device is now linked to ONE account for good
 * (see device-binding.ts), which covers "same browser, two accounts" for every class, not just this one.
 */
export function buildDeviceClaims(input: ClaimInput): DeviceClaims {
  const { courseId, classId, startTime, endTime, regNumber, ip, fingerprint } = input;
  const col = db.collection("classes").doc(courseId).collection("sessions").doc(classId).collection("claims");
  const fp = hash(fingerprint);
  const ipHash = hash(ip);
  const end = typeof endTime === "number" && endTime > startTime ? endTime : startTime + DEFAULT_CLASS_LENGTH_MS;
  return {
    refs: [col.doc(`p_${fp}_${ipHash}`)],
    data: {
      regNumber,
      courseId,
      classId,
      fp,
      ip: ipHash,
      ts: Date.now(),
      expiresAt: Timestamp.fromMillis(end + RETENTION_AFTER_CLASS_MS),
    },
  };
}
