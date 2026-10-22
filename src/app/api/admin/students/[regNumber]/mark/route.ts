import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, getAccessibleCourses } from "@/lib/admin-auth";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { audienceOf, isEligibleForCourse } from "@/lib/enrollment";
import type { MarkableSession } from "@/types/admin";

type Ctx = { params: Promise<{ regNumber: string }> };

async function validate(req: NextRequest, ctx: Ctx, courseId: unknown) {
  const admin = await verifyAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };

  const reg = (await ctx.params).regNumber.trim().toUpperCase();
  if (!REG_NUMBER_REGEX.test(reg)) return { error: NextResponse.json({ error: "Invalid registration number." }, { status: 400 }) };
  if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
    return { error: NextResponse.json({ error: "A course is required." }, { status: 400 }) };
  }

  const studentDoc = await db.collection("students").doc(reg).get();
  if (!studentDoc.exists) return { error: NextResponse.json({ error: "Student not found." }, { status: 404 }) };

  const [course] = await getAccessibleCourses(admin, courseId);
  if (!course) return { error: NextResponse.json({ error: "You don't have access to that course." }, { status: 403 }) };

  const courseDoc = await db.collection("courses").doc(course.id).get();
  const audience = audienceOf(courseDoc.data());
  // Only students the course is for (their level, or an approved carry-over) can be marked
  const eligible = await isEligibleForCourse(course.id, audience, reg);

  return { admin, reg, student: studentDoc.data()!, course, eligible };
}

const NOT_ELIGIBLE = "This student isn't in this course's level and has no approved carry-over.";

// GET ?courseId= — the course's classes (newest first), flagged where the student is already present
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const v = await validate(req, ctx, new URL(req.url).searchParams.get("courseId"));
    if ("error" in v) return v.error;

    const [sessionsSnap, recordsSnap] = await Promise.all([
      db.collection("classes").doc(v.course.id).collection("sessions").orderBy("createdAt", "desc").get(),
      db.collection("students").doc(v.reg).collection("attendance").doc(v.course.id).collection("records").get(),
    ]);
    const present = new Set(recordsSnap.docs.map((d) => d.id));

    const sessions: MarkableSession[] = sessionsSnap.docs.map((d) => {
      const s = d.data();
      return {
        id: d.id,
        date: String(s.date ?? ""),
        startTime: Number(s.startTime ?? s.createdAt ?? 0),
        endTime: Number(s.endTime ?? 0),
        locationName: (s.locationName as string | undefined) ?? null,
        present: present.has(d.id),
      };
    });
    return NextResponse.json({ sessions, eligible: v.eligible });
  } catch (error) {
    console.error("Mark-present lookup error:", error);
    return NextResponse.json({ error: "Failed to load classes." }, { status: 500 });
  }
}

// POST { courseId, classId } — mark the student present for that class
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { courseId, classId } = await req.json();
    const v = await validate(req, ctx, courseId);
    if ("error" in v) return v.error;
    if (typeof classId !== "string" || !classId || classId.includes("/")) {
      return NextResponse.json({ error: "A class is required." }, { status: 400 });
    }
    if (!v.eligible) return NextResponse.json({ error: NOT_ELIGIBLE, code: "NOT_ENROLLED" }, { status: 403 });
    if (v.student.banned) {
      return NextResponse.json({ error: "This student's attendance is suspended." }, { status: 403 });
    }

    const studentRef = db.collection("students").doc(v.reg);
    const sessionRef = db.collection("classes").doc(v.course.id).collection("sessions").doc(classId);
    const recordRef = studentRef.collection("attendance").doc(v.course.id).collection("records").doc(classId);

    // One transaction: the record and both counters land together, and a double-click can't count twice
    const outcome = await db.runTransaction(async (tx) => {
      const [sessionSnap, recordSnap] = await Promise.all([tx.get(sessionRef), tx.get(recordRef)]);
      if (!sessionSnap.exists) return { status: "NO_CLASS" as const };
      if (recordSnap.exists) return { status: "ALREADY" as const };

      const s = sessionSnap.data()!;
      tx.create(recordRef, {
        // Same shape as a self-mark. `date` is the class's day so "Revoke a day" finds it; `timestamp` places it
        // at the class start. Never late: an admin is vouching for the student's presence.
        timestamp: Number(s.startTime ?? s.createdAt ?? Date.now()),
        courseId: v.course.id,
        classId,
        date: s.date,
        late: false,
        regNumber: v.reg,
        markedBy: v.admin.uid,
        manual: true,
        markedAt: Date.now(),
      });
      tx.update(sessionRef, { totalPresence: FieldValue.increment(1) });
      tx.update(studentRef, { totalPresence: FieldValue.increment(1) });
      return { status: "OK" as const, date: s.date as string };
    });

    if (outcome.status === "NO_CLASS") return NextResponse.json({ error: "That class no longer exists." }, { status: 404 });
    if (outcome.status === "ALREADY") return NextResponse.json({ error: "Already marked present for that class." }, { status: 409 });

    await db.collection("activityLog").add({
      action: "admin_mark_present",
      courseId: v.course.id,
      classId,
      regNumber: v.reg,
      studentName: v.student.name ?? null,
      date: outcome.date,
      adminUid: v.admin.uid,
      adminName: v.admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark present error:", error);
    return NextResponse.json({ error: "Failed to mark attendance." }, { status: 500 });
  }
}
