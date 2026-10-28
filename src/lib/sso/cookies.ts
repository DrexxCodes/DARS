import { SELF, SSO_HINT_COOKIE, SSO_MAX_AGE_S, isPlatformId, ssoCookieName, type PlatformId } from "./platforms";
import { signSsoToken, ssoEnabled } from "./token";

/** A cookie to set, framework-neutral so route handlers and next/headers can both apply it: `jar.set(c.name, c.value, c.options)`. */
export interface CookieSpec {
  name: string;
  value: string;
  options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number; domain?: string };
}

/** Set SSO_COOKIE_DOMAIN (e.g. ".yourschool.edu.ng") when the two apps live on sibling subdomains. Leave empty on localhost. */
const domain = (): string | undefined => process.env.SSO_COOKIE_DOMAIN?.trim() || undefined;
const base = (httpOnly: boolean, maxAge: number): CookieSpec["options"] => ({
  httpOnly, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge, ...(domain() ? { domain: domain() } : {}),
});

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!raw) return undefined;
  try { return decodeURIComponent(raw); } catch { return undefined; }
}

const parseHint = (v: string | undefined): PlatformId[] => (v ? v.split(",").filter(isPlatformId) : []);
const hintSpec = (ids: PlatformId[]): CookieSpec => ({ name: SSO_HINT_COOKIE, value: ids.join(","), options: base(false, ids.length ? SSO_MAX_AGE_S : 0) });

/** Cookies that record "this browser is signed in to SELF as uid". Empty when SSO is not configured. */
export function issueSsoCookies(req: Request, uid: string): CookieSpec[] {
  if (!ssoEnabled()) return [];
  const token = signSsoToken(uid, SELF);
  if (!token) return [];
  const hint = [...new Set([...parseHint(readCookie(req, SSO_HINT_COOKIE)), SELF])];
  return [{ name: ssoCookieName(SELF), value: token, options: base(true, SSO_MAX_AGE_S) }, hintSpec(hint)];
}

/** Cookies that remove SELF from this browser's SSO record (sign-out). */
export function clearSsoCookies(req: Request): CookieSpec[] {
  const hint = parseHint(readCookie(req, SSO_HINT_COOKIE)).filter((id) => id !== SELF);
  return [{ name: ssoCookieName(SELF), value: "", options: base(true, 0) }, hintSpec(hint)];
}

/** The SSO endpoints change state with cookies, so they only answer calls made from the app's own pages. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
