import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, canAccessCourse } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { courseVisibleToStudent } from "@/lib/admission";
import { audienceOf, enrollmentRef, isEnrolled } from "@/lib/enrollment";
import { delistStudent } from "@/lib/delist";

type Ctx = { params: Promise<{ regNumber: string }> };

// POST { courseId } — an admin with the course.student.delist scope delists a student from a course. Same effect as the student doing it themselves:
// permanent, their attendance for the course is wiped and the course drops out of their records.
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const denied = requireScope(admin, "course.student.delist");
    if (denied) return denied;

    const reg = (await ctx.params).regNumber.trim().toUpperCase();
    if (!REG_NUMBER_REGEX.test(reg)) return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });

    const { courseId } = await req.json();
    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "A course is required." }, { status: 400 });
    }
    if (!(await canAccessCourse(admin, courseId))) {
      return NextResponse.json({ error: "You don't have access to that course." }, { status: 403 });
    }

    const [courseDoc, enrolDoc] = await Promise.all([db.collection("courses").doc(courseId).get(), enrollmentRef(courseId, reg).get()]);
    if (!courseDoc.exists) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    const status = enrolDoc.exists ? (enrolDoc.data()?.status as string | undefined) : undefined;
    if (status !== "delisted" && !isEnrolled(courseVisibleToStudent(audienceOf(courseDoc.data()), reg), status)) {
      return NextResponse.json({ error: "That student isn't enrolled in this course." }, { status: 400 });
    }

    const result = await delistStudent(reg, courseId, { by: admin.uid, byName: admin.name });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason === "STUDENT_NOT_FOUND" ? "Student not found." : "Course not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, recordsCleared: result.recordsCleared });
  } catch (error) {
    console.error("Admin delist error:", error);
    return NextResponse.json({ error: "Couldn't delist the student. Please try again." }, { status: 500 });
  }
}
