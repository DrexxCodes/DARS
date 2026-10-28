import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/device-check";
import { clearSsoCookies, isSameOrigin, issueSsoCookies, type CookieSpec } from "@/lib/sso/cookies";
import { ssoEnabled } from "@/lib/sso/token";

const respond = (body: object, specs: CookieSpec[], status = 200) => {
  const res = NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  for (const c of specs) res.cookies.set(c.name, c.value, c.options);
  return res;
};

// POST /api/auth/sso/session — record that this browser is signed in to DARS (called once per sign-in, with the user's ID token).
export async function POST(req: NextRequest) {
  if (!ssoEnabled()) return NextResponse.json({ success: true, enabled: false });
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!rateLimit(`sso-sync:${getClientIp(req)}`, 30, 60_000).allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { uid } = await auth.verifyIdToken(token);
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists || snap.data()?.banned === true) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    return respond({ success: true }, issueSsoCookies(req, uid));
  } catch {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }
}

// DELETE /api/auth/sso/session — sign-out: forget DARS in this browser's SSO record. Needs no credential, and only removes things.
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return respond({ success: true }, clearSsoCookies(req));
}
