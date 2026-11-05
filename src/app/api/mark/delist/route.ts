import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { courseVisibleToStudent } from "@/lib/admission";
import { audienceOf, enrollmentRef, isEnrolled } from "@/lib/enrollment";
import { getStudentCaller } from "@/lib/student-auth";
import { delistStudent } from "@/lib/delist";

// POST { courseId } — the signed-in student drops a course they take (their level's or an Added Course).
// Permanent: their attendance for it is wiped and the course disappears from their records.
export async function POST(req: NextRequest) {
  try {
    const me = await getStudentCaller(req);
    if ("error" in me) return me.error;
    if (!rateLimit(`delist:${me.uid}`, 10, 60_000).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please wait a moment.", code: "RATE_LIMITED" }, { status: 429 });
    }

    const { courseId } = await req.json();
    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "Course is required." }, { status: 400 });
    }

    const [courseDoc, enrolDoc] = await Promise.all([db.collection("courses").doc(courseId).get(), enrollmentRef(courseId, me.reg).get()]);
    if (!courseDoc.exists) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const status = enrolDoc.exists ? (enrolDoc.data()?.status as string | undefined) : undefined;
    // Already delisted counts as fine (it just finishes an interrupted wipe). Anything else must be a course they take.
    if (status !== "delisted" && !isEnrolled(courseVisibleToStudent(audienceOf(courseDoc.data()), me.reg), status)) {
      return NextResponse.json({ error: "You're not enrolled in this course." }, { status: 400 });
    }

    const result = await delistStudent(me.reg, courseId, { by: "self", byName: me.name || me.reg });
    if (!result.ok) return NextResponse.json({ error: "Student or course not found." }, { status: 404 });
    return NextResponse.json({ success: true, recordsCleared: result.recordsCleared });
  } catch (error) {
    console.error("Delist error:", error);
    return NextResponse.json({ error: "Couldn't delist the course. Please try again." }, { status: 500 });
  }
}
