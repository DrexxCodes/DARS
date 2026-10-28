"use client";

import { SELF, SSO_HINT_COOKIE, isPlatformId, type PlatformId, type SsoOffer } from "./platforms";

/** Browser-side half of cross-app sign-in. Server half: src/app/api/auth/sso/**. */

const DISMISS_KEY = "sso:dismissed";
const SYNCED_KEY = "sso:synced";

/** Platforms this browser has an SSO cookie for (read from the non-secret hint cookie). */
export function readSsoHint(): PlatformId[] {
  if (typeof document === "undefined") return [];
  // A stale host-only copy (from before the cookie domain was configured) can sit beside the real one: read them all.
  const all = document.cookie.split(/;\s*/).filter((c) => c.startsWith(`${SSO_HINT_COOKIE}=`)).flatMap((c) => decodeURIComponent(c.slice(SSO_HINT_COOKIE.length + 1)).split(","));
  return [...new Set(all.filter(isPlatformId))];
}

export const isSsoDismissed = (): boolean => {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
};
/** "Not now", or signing out on purpose: stop offering for the rest of this tab session. */
export const dismissSso = () => {
  try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
};

/**
 * After sign-in: make sure the other app can see we're signed in here. Runs once per tab session (one small request that
 * also renews the cookie). The hint cookie alone isn't trusted: a stale one can claim "done" when the real cookie is missing.
 */
export async function ensureSsoCookie(getIdToken: () => Promise<string>): Promise<void> {
  try {
    if (sessionStorage.getItem(SYNCED_KEY) === "1" && readSsoHint().includes(SELF)) return;
    sessionStorage.setItem(SYNCED_KEY, "1");
  } catch {}
  try {
    await fetch("/api/auth/sso/session", { method: "POST", headers: { Authorization: `Bearer ${await getIdToken()}` } });
  } catch {}
}

/** On sign-out: forget this app in the SSO record. */
export async function clearSsoCookie(): Promise<void> {
  try { sessionStorage.removeItem(SYNCED_KEY); } catch {}
  try { await fetch("/api/auth/sso/session", { method: "DELETE", keepalive: true }); } catch {}
}

export async function peekSso(): Promise<SsoOffer | null> {
  try {
    const res = await fetch("/api/auth/sso", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { offer: SsoOffer | null }).offer;
  } catch {
    return null;
  }
}

export async function exchangeSso(from: PlatformId): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/auth/sso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) return { ok: false, message: data.error || "Couldn't sign you in. Please use your password." };
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, message: "You appear to be offline. Check your connection and try again." };
  }
}
