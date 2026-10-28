import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { REG_NUMBER_REGEX } from "@/lib/utils";

class RegError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// NPS admission types and the 3-digit code each one uses (NPS: ADMISSION_CODES).
const NPS_TYPE_CODE: Record<string, string> = { REGULAR: "134", CEP: "133" };

// POST /api/profile/reg-number { regNumber } — for an account that arrived from NPS without a registration number.
// Creates the students/{regNumber} record DARS needs before attendance can be marked. Write-once.
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please sign in.", code: "AUTH_REQUIRED" }, { status: 401 });

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!rateLimit(`regnumber:${uid}`, 8, 60_000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reg = typeof body.regNumber === "string" ? body.regNumber.trim().toUpperCase() : "";
    if (!REG_NUMBER_REGEX.test(reg)) {
      return NextResponse.json({ error: "Invalid registration number format.", code: "INVALID_REG" }, { status: 400 });
    }

    await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const studentRef = db.collection("students").doc(reg);
      const [userSnap, studentSnap] = await Promise.all([tx.get(userRef), tx.get(studentRef)]);
      const u = userSnap.data();
      if (!u) throw new RegError(404, "Account not found.");
      if (u.banned === true) throw new RegError(403, "This account has been suspended.");
      if (u.regNumber) {
        if (u.regNumber === reg) return; // already done (double tap / retry)
        throw new RegError(409, "Your registration number is already set. Contact an administrator to change it.");
      }
      if (studentSnap.exists && studentSnap.data()?.uid !== uid) {
        throw new RegError(409, "This registration number is already registered.");
      }
      // An account that came from NPS carries the Regular/CEP choice made there: the number has to agree with it.
      const wanted = NPS_TYPE_CODE[String(u.admissionType ?? "")];
      const code = reg.slice(4, 7);
      if (wanted && (code === "133" || code === "134") && code !== wanted) {
        throw new RegError(400, `That number doesn't match the ${u.admissionType === "CEP" ? "CEP" : "Regular"} admission type on your account.`);
      }
      const name = String(u.name ?? u.fullName ?? "");
      tx.set(
        studentRef,
        studentSnap.exists
          ? { uid, name, email: u.email ?? "" }
          : { uid, name, email: u.email ?? "", regNumber: reg, totalPresence: 0, createdAt: Date.now() },
        { merge: true }
      );
      tx.update(userRef, { regNumber: reg });
    });

    return NextResponse.json({ success: true, regNumber: reg });
  } catch (error) {
    if (error instanceof RegError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Save reg number error:", error);
    return NextResponse.json({ error: "Couldn't save your registration number. Please try again." }, { status: 500 });
  }
}
