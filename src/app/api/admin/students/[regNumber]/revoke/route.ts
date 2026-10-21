import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, getAccessibleCourses } from "@/lib/admin-auth";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import type { RevokeRecord } from "@/types/admin";

// `date` on a record is the day it was marked (YYYY-MM-DD, UTC), exactly as stored by /api/mark.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type Ctx = { params: Promise<{ regNumber: string }> };

const recordsQuery = (reg: string, courseId: string, date: string) =>
  db.collection("students").doc(reg).collection("attendance").doc(courseId).collection("records").where("date", "==", date);

async function validate(req: NextRequest, ctx: Ctx, date: string | null, courseId: string | null) {
  const admin = await verifyAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };

  const reg = (await ctx.params).regNumber.trim().toUpperCase();
  if (!REG_NUMBER_REGEX.test(reg)) return { error: NextResponse.json({ error: "Invalid registration number." }, { status: 400 }) };
  if (!date || !DATE_REGEX.test(date)) return { error: NextResponse.json({ error: "A valid date is required." }, { status: 400 }) };

  const studentDoc = await db.collection("students").doc(reg).get();
  if (!studentDoc.exists) return { error: NextResponse.json({ error: "Student not found." }, { status: 404 }) };

  const courses = await getAccessibleCourses(admin, courseId);
  if (courses.length === 0) {
    return { error: NextResponse.json({ error: "You don't have access to that course." }, { status: 403 }) };
  }
  return { admin, reg, student: studentDoc.data()!, courses, date };
}

// GET — preview: which records would be revoked for that day
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const q = new URL(req.url).searchParams;
    const v = await validate(req, ctx, q.get("date"), q.get("courseId"));
    if ("error" in v) return v.error;

    const results = await Promise.all(
      v.courses.map(async (c) => ({ course: c, snap: await recordsQuery(v.reg, c.id, v.date).get() }))
    );
    const records: RevokeRecord[] = results.flatMap(({ course, snap }) =>
      snap.docs.map((d) => ({
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        classId: d.id,
        timestamp: d.data().timestamp ?? 0,
        late: !!d.data().late,
      }))
    );
    records.sort((a, b) => a.timestamp - b.timestamp);
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Revoke preview error:", error);
    return NextResponse.json({ error: "Failed to look up attendance." }, { status: 500 });
  }
}

// POST — revoke every record that student has on that day (optionally limited to one course)
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { date, courseId } = await req.json();
    const v = await validate(req, ctx, date ?? null, courseId ?? null);
    if ("error" in v) return v.error;

    const studentRef = db.collection("students").doc(v.reg);

    // One transaction so the deletes and the counter changes land together and a double-click can't decrement twice
    const removed = await db.runTransaction(async (tx) => {
      const results = await Promise.all(
        v.courses.map(async (c) => ({ course: c, snap: await tx.get(recordsQuery(v.reg, c.id, v.date)) }))
      );
      const found = results.flatMap(({ course, snap }) =>
        snap.docs.map((d) => ({ courseId: course.id, classId: d.id, ref: d.ref }))
      );
      if (found.length === 0) return [];

      const sessionRefs = found.map((f) => db.collection("classes").doc(f.courseId).collection("sessions").doc(f.classId));
      const sessionSnaps = await tx.getAll(...sessionRefs);

      found.forEach((f, i) => {
        tx.delete(f.ref);
        if (sessionSnaps[i].exists) tx.update(sessionRefs[i], { totalPresence: FieldValue.increment(-1) });
      });
      tx.update(studentRef, { totalPresence: FieldValue.increment(-found.length) });
      return found;
    });

    if (removed.length === 0) {
      return NextResponse.json({ error: "No attendance found for that day.", revoked: 0 }, { status: 404 });
    }

    await db.collection("activityLog").add({
      action: "revoke_attendance",
      regNumber: v.reg,
      studentName: v.student.name ?? null,
      date: v.date,
      courseIds: [...new Set(removed.map((r) => r.courseId))],
      recordsRevoked: removed.length,
      adminUid: v.admin.uid,
      adminName: v.admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, revoked: removed.length });
  } catch (error) {
    console.error("Revoke attendance error:", error);
    return NextResponse.json({ error: "Failed to revoke attendance." }, { status: 500 });
  }
}
