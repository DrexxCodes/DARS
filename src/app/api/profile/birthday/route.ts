import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { checkDob } from "@/lib/birthday";
import { BirthdayError, saveBirthday } from "@/lib/birthday-store";

// POST /api/profile/birthday { dateOfBirth: "YYYY-MM-DD" } — the signed-in user records their own birthday (write-once).
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please sign in.", code: "AUTH_REQUIRED" }, { status: 401 });

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!rateLimit(`birthday:${uid}`, 10, 60_000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const check = checkDob(typeof body.dateOfBirth === "string" ? body.dateOfBirth : "");
    if (!check.ok) return NextResponse.json({ error: check.message, code: "INVALID_DOB" }, { status: 400 });

    const { alreadySet } = await saveBirthday(uid, check.dob);
    return NextResponse.json({ success: true, alreadySet });
  } catch (error) {
    if (error instanceof BirthdayError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "NOT_FOUND" ? 404 : 403 });
    }
    console.error("Save birthday error:", error);
    return NextResponse.json({ error: "Couldn't save your birthday. Please try again." }, { status: 500 });
  }
}
