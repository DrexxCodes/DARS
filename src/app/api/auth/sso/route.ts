import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/device-check";
import { PLATFORMS, SELF, isPlatformId, otherPlatformIds, ssoCookieName, type PlatformId, type SsoOffer } from "@/lib/sso/platforms";
import { issuedBeforeRevocation, verifySsoToken, ssoEnabled } from "@/lib/sso/token";
import { isSameOrigin, readCookie } from "@/lib/sso/cookies";

const noStore = { "Cache-Control": "no-store" };

/** Resolves "signed in to <from> as <uid>" into a usable, not-revoked, not-banned user, or null. */
async function resolveSession(req: NextRequest, from: PlatformId) {
  const claims = verifySsoToken(readCookie(req, ssoCookieName(from)), from);
  if (!claims) return null;
  const [record, snap] = await Promise.all([
    auth.getUser(claims.uid).catch(() => null),
    db.collection("users").doc(claims.uid).get(),
  ]);
  if (!record || record.disabled || issuedBeforeRevocation(record.tokensValidAfterTime, claims.iat)) return null;
  const data = snap.data();
  if (!data) return null;
  return { uid: claims.uid, data, blocked: data.banned === true || data.accountStatus === "SUSPENDED" };
}

// GET /api/auth/sso — is this browser signed in to the other platform? Only called when the readable hint cookie says so.
export async function GET(req: NextRequest) {
  // No CORS headers are sent, so a page on another site can't read this answer even if it makes the request.
  if (!ssoEnabled()) return NextResponse.json({ offer: null }, { headers: noStore });
  if (!rateLimit(`sso-peek:${getClientIp(req)}`, 60, 60_000).allowed) return NextResponse.json({ offer: null }, { status: 429, headers: noStore });

  for (const id of otherPlatformIds()) {
    const s = await resolveSession(req, id);
    if (!s || s.blocked) continue;
    const full = String(s.data.fullName ?? s.data.name ?? "").trim();
    const offer: SsoOffer = { id, name: PLATFORMS[id].name, firstName: full.split(/\s+/)[0] || "there" };
    return NextResponse.json({ offer }, { headers: noStore });
  }
  return NextResponse.json({ offer: null }, { headers: noStore });
}

// POST /api/auth/sso { from } — trade the other platform's SSO cookie for a Firebase custom token to sign in with here.
export async function POST(req: NextRequest) {
  if (!ssoEnabled()) return NextResponse.json({ error: "Single sign-in isn't set up.", code: "SSO_DISABLED" }, { status: 501 });
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit(`sso:${getClientIp(req)}`, 15, 60_000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment.", code: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const from = body.from;
    if (!isPlatformId(from) || from === SELF) return NextResponse.json({ error: "Unknown platform.", code: "BAD_REQUEST" }, { status: 400 });

    const s = await resolveSession(req, from);
    if (!s) return NextResponse.json({ error: `Your ${PLATFORMS[from].name} session has ended. Please sign in here.`, code: "NO_SSO_SESSION" }, { status: 401 });
    if (s.blocked) return NextResponse.json({ error: "This account has been suspended.", code: "BANNED" }, { status: 403 });

    const token = await auth.createCustomToken(s.uid);
    return NextResponse.json({ success: true, token }, { headers: noStore });
  } catch (error) {
    console.error("SSO exchange error:", error);
    return NextResponse.json({ error: "Couldn't sign you in. Please sign in with your password.", code: "SSO_FAILED" }, { status: 500 });
  }
}
