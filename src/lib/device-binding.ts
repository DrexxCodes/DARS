import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { hash } from "@/lib/device-check";

/**
 * Account <-> device linking.
 *
 * The first time a student marks attendance, their account is linked to the browser they marked from, and that browser is
 * linked to their account. From then on:
 *   - their account only marks from that browser (a friend signing in as them on another phone or browser is refused), and
 *   - that browser only marks for that account (one phone can't sign in for several people).
 * A super admin can reset the link when a student changes phone or clears their browser data.
 *
 * "Browser" = a random ID kept in an httpOnly cookie the server hands out, mirrored by the localStorage ID the app already
 * sends. Whichever survives is used, so wiping just one of them doesn't make a browser look new.
 *
 * Stored as students/{REG}.boundDevice = { did, boundAt } and deviceBindings/{did} = { regNumber, boundAt }.
 * Both hold only a salted hash, never the raw ID.
 */

export const DEVICE_COOKIE = "dars_did";
const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60; // browsers cap cookies at about 400 days
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

export const DEVICE_MISMATCH = {
  error: "This account is linked to a different phone or browser. If you changed phones or cleared your browser data, ask a super admin to reset your device.",
  code: "DEVICE_MISMATCH",
} as const;

export const DEVICE_TAKEN = {
  error: "This phone or browser is already linked to another student's account.",
  code: "DEVICE_TAKEN",
} as const;

export const bindingRef = (didHash: string) => db.collection("deviceBindings").doc(didHash);

/** The server's cookie wins; otherwise the ID the app sent. `issueCookie` means this browser has no cookie yet. */
export function resolveDeviceId(req: NextRequest, clientDeviceId: string): { deviceId: string; issueCookie: boolean } {
  const cookie = req.cookies.get(DEVICE_COOKIE)?.value;
  if (cookie && DEVICE_ID.test(cookie)) return { deviceId: cookie, issueCookie: false };
  return { deviceId: clientDeviceId, issueCookie: true };
}

export function setDeviceCookie(res: NextResponse, deviceId: string): void {
  res.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_S,
  });
}

export const hashDeviceId = (deviceId: string) => hash(deviceId);

export type BindingDecision =
  | { ok: true; /** Create the link in the same batch as the attendance record. */ bindNow: boolean; /** The link doc is already there (stale), so overwrite instead of create. */ overwrite: boolean }
  | { ok: false; response: typeof DEVICE_MISMATCH | typeof DEVICE_TAKEN };

/**
 * @param studentDeviceHash  the device hash stored on the student's own record (null = not linked yet)
 * @param bindingOwner       who the browser's link doc says owns it (null = no doc)
 */
export function decideBinding(args: {
  regNumber: string;
  deviceHash: string;
  studentDeviceHash: string | null;
  bindingOwner: string | null;
}): BindingDecision {
  const { regNumber, deviceHash, studentDeviceHash, bindingOwner } = args;
  if (studentDeviceHash) {
    return studentDeviceHash === deviceHash ? { ok: true, bindNow: false, overwrite: false } : { ok: false, response: DEVICE_MISMATCH };
  }
  if (bindingOwner && bindingOwner !== regNumber) return { ok: false, response: DEVICE_TAKEN };
  return { ok: true, bindNow: true, overwrite: bindingOwner === regNumber };
}
