import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { hasBirthday } from "@/lib/birthday";

/**
 * Resolves the signed-in student from the Bearer token (account + registration number).
 * Returns `{ error }` (a ready-to-send response) when they aren't signed in or have no valid reg number.
 */
export async function getStudentCaller(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: NextResponse.json({ error: "Please sign in.", code: "AUTH_REQUIRED" }, { status: 401 }) };
  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token)).uid;
  } catch {
    return { error: NextResponse.json({ error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" }, { status: 401 }) };
  }
  const userDoc = await db.collection("users").doc(uid).get();
  const reg = userDoc.data()?.regNumber as string | undefined;
  if (!userDoc.exists || !reg || !REG_NUMBER_REGEX.test(reg)) {
    return { error: NextResponse.json({ error: "Your account has no registration number on file." }, { status: 400 }) };
  }
  return { uid, reg, name: String(userDoc.data()?.name ?? ""), birthday: hasBirthday(userDoc.data()) };
}
