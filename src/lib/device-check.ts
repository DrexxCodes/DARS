import { createHash } from "crypto";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import type { DeviceSignals } from "@/types/device";

const SALT = process.env.DEVICE_HASH_SALT || "dars-device-salt";
const HEX_64 = /^[a-f0-9]{64}$/;
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

/** Claims stay for the class length (2h) plus this, then Firestore TTL removes them. Kept a day for admin audits. */
const RETENTION_AFTER_CLASS_MS = 24 * 60 * 60 * 1000;
const CLASS_LENGTH_MS = 2 * 60 * 60 * 1000;

export const DEVICE_CONFLICT = {
  error: "Couldn't mark this attendance. Something looks sketchy.",
  code: "DEVICE_CONFLICT",
} as const;

export const SIGNALS_REQUIRED = {
  error: "Please refresh the app and try again.",
  code: "SIGNALS_REQUIRED",
} as const;

function hash(value: string): string {
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
  regNumber: string;
  ip: string;
  signals: DeviceSignals;
}

export interface DeviceClaims {
  refs: [DocumentReference, DocumentReference];
  data: Record<string, unknown>;
}

/**
 * Two deterministic claim docs per mark, under the class session (so different courses never collide):
 *   d_<deviceId>        same browser profile already marked this class
 *   p_<fingerprint>_<ip> same phone model on the same network already marked (incognito, other browser, installed app vs Safari)
 * Same IP alone is fine (hotspots/CGNAT), and same fingerprint alone is fine (identical phone models on different networks).
 * Deterministic IDs + create() make the check atomic with the attendance write.
 */
export function buildDeviceClaims(input: ClaimInput): DeviceClaims {
  const { courseId, classId, startTime, regNumber, ip, signals } = input;
  const col = db.collection("classes").doc(courseId).collection("sessions").doc(classId).collection("claims");
  const fp = hash(signals.fingerprint);
  const did = hash(signals.deviceId);
  const ipHash = hash(ip);
  return {
    refs: [col.doc(`d_${did}`), col.doc(`p_${fp}_${ipHash}`)],
    data: {
      regNumber,
      courseId,
      classId,
      fp,
      did,
      ip: ipHash,
      ts: Date.now(),
      expiresAt: Timestamp.fromMillis(startTime + CLASS_LENGTH_MS + RETENTION_AFTER_CLASS_MS),
    },
  };
}
