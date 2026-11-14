import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { verifyAdmin, type AdminUser } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { streamJob, wantsStream } from "@/lib/progress-stream";
import { deleteStudentAccount } from "@/lib/student-account";
import type { ScopeKey } from "@/constants/scopes";

type Ctx = { params: Promise<{ regNumber: string }> };

/** Shared checks: signed-in admin with the scope, a real student, and a target the caller is allowed to touch. */
async function load(req: NextRequest, ctx: Ctx, scope: ScopeKey) {
  const admin = await verifyAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  const denied = requireScope(admin, scope);
  if (denied) return { error: denied };

  const reg = (await ctx.params).regNumber.trim().toUpperCase();
  if (!REG_NUMBER_REGEX.test(reg)) return { error: NextResponse.json({ error: "Invalid registration number." }, { status: 400 }) };

  const studentDoc = await db.collection("students").doc(reg).get();
  if (!studentDoc.exists) return { error: NextResponse.json({ error: "Student not found." }, { status: 404 }) };
  const student = studentDoc.data()!;

  let uid: string | null = (student.uid as string | undefined) ?? null;
  if (!uid) {
    const linked = await db.collection("users").where("regNumber", "==", reg).limit(1).get();
    uid = linked.docs[0]?.id ?? null;
  }
  if (uid && uid === admin.uid) return { error: NextResponse.json({ error: "You can't do that to your own account." }, { status: 400 }) };

  const userDoc = uid ? await db.collection("users").doc(uid).get() : null;
  // Admin accounts are managed from Admin Management, so a student-level tool can't be used to lock one out or delete one
  if (userDoc?.data()?.admin === true) {
    return { error: NextResponse.json({ error: "That account is an admin. Revoke their admin access first.", code: "TARGET_IS_ADMIN" }, { status: 400 }) };
  }

  return { admin, reg, uid, student, userDoc };
}

const log = (admin: AdminUser, action: string, reg: string, name: unknown, extra: Record<string, unknown> = {}) =>
  db.collection("activityLog").add({ action, regNumber: reg, studentName: name ?? null, adminUid: admin.uid, adminName: admin.name, timestamp: Date.now(), ...extra });

// POST { action: "reset_password" | "disable" | "enable" } — scope: student.lookup (lookup comes with editing)
//   reset_password: authorises and records the request, and returns the email; the browser then asks Firebase to send
//                   the reset email (the Admin SDK can create a reset link but cannot send mail).
//   disable / enable: blocks or restores sign-in (Firebase Auth) and attendance marking, and ends their current sessions.
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const v = await load(req, ctx, "student.lookup");
    if ("error" in v) return v.error;
    const { action } = await req.json();

    if (action === "reset_password") {
      let email = typeof v.student.email === "string" ? v.student.email : "";
      if (v.uid) email = (await auth.getUser(v.uid).catch(() => null))?.email ?? email;
      if (!email) return NextResponse.json({ error: "There's no email on file for this student." }, { status: 400 });
      await log(v.admin, "reset_password_requested", v.reg, v.student.name);
      return NextResponse.json({ success: true, email });
    }

    if (action === "disable" || action === "enable") {
      if (!v.uid) return NextResponse.json({ error: "This student has no login account." }, { status: 400 });
      const disable = action === "disable";
      await auth.updateUser(v.uid, { disabled: disable });
      if (disable) await auth.revokeRefreshTokens(v.uid);
      // `banned` is what the mark route checks on every request, so this takes effect immediately, not when their token expires
      await Promise.all([
        db.collection("users").doc(v.uid).set({ banned: disable }, { merge: true }),
        db.collection("students").doc(v.reg).update({ banned: disable }),
      ]);
      await log(v.admin, disable ? "disable_student" : "enable_student", v.reg, v.student.name);
      return NextResponse.json({ success: true, disabled: disable });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Student account action error:", error);
    return NextResponse.json({ error: "Couldn't complete that. Please try again." }, { status: 500 });
  }
}

// DELETE — permanently delete the student's account and every attendance record. Scope: student.delete
// Send `Accept: application/x-ndjson` for live progress.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const v = await load(req, ctx, "student.delete");
    if ("error" in v) return v.error;

    const name = String(v.student.name ?? "");
    const job = async (report: Parameters<typeof deleteStudentAccount>[1]) => {
      const result = await deleteStudentAccount({ regNumber: v.reg, uid: v.uid, name }, report);
      // The log keeps who and when, not the student's email or other details
      await log(v.admin, "delete_student", v.reg, null, { recordsCleared: result.recordsCleared });
      return { ...result, name };
    };

    if (wantsStream(req)) return streamJob(job);
    return NextResponse.json({ success: true, ...(await job(() => {})) });
  } catch (error) {
    console.error("Delete student error:", error);
    return NextResponse.json({ error: "Couldn't delete the student. Please try again." }, { status: 500 });
  }
}
