import { createHmac, timingSafeEqual } from "node:crypto";
import { SSO_MAX_AGE_S, type PlatformId } from "./platforms";

/**
 * The SSO cookie value: base64url(payload) + "." + base64url(HMAC-SHA256). Both apps verify it with the same SSO_SECRET,
 * so neither needs the other's code or an API call. It proves "this browser signed in to <platform> as <uid>"; it is never
 * a Firebase credential: the receiving app still mints its own session through Firebase.
 */
export interface SsoClaims {
  uid: string;
  platform: PlatformId;
  iat: number;
  exp: number;
}

const secret = (): string | null => {
  const s = process.env.SSO_SECRET;
  return s && s.length >= 32 ? s : null;
};

/** SSO is switched on only when SSO_SECRET (32+ chars) is set in both apps. */
export const ssoEnabled = (): boolean => secret() !== null;

const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");
const mac = (body: string, key: string) => createHmac("sha256", key).update(body).digest();

export function signSsoToken(uid: string, platform: PlatformId, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const iat = Math.floor(now / 1000);
  const body = b64(JSON.stringify({ u: uid, p: platform, i: iat, e: iat + SSO_MAX_AGE_S }));
  return `${body}.${b64(mac(body, key))}`;
}

export function verifySsoToken(value: string | undefined | null, platform: PlatformId, now = Date.now()): SsoClaims | null {
  const key = secret();
  if (!key || !value) return null;
  const [body, sig, extra] = value.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = mac(body, key);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as { u?: unknown; p?: unknown; i?: unknown; e?: unknown };
    if (typeof c.u !== "string" || c.p !== platform || typeof c.i !== "number" || typeof c.e !== "number") return null;
    if (c.e <= Math.floor(now / 1000)) return null;
    return { uid: c.u, platform, iat: c.i, exp: c.e };
  } catch {
    return null;
  }
}

/** A password reset or "sign out everywhere" moves tokensValidAfterTime forward; any SSO cookie issued before that is dead. */
export const issuedBeforeRevocation = (tokensValidAfterTime: string | undefined, iat: number): boolean =>
  !!tokensValidAfterTime && Date.parse(tokensValidAfterTime) / 1000 > iat;
