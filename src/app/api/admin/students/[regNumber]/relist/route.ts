import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, canAccessCourse } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { courseVisibleToStudent } from "@/lib/admission";
import { audienceOf, enrollmentRef } from "@/lib/enrollment";

type Ctx = { params: Promise<{ regNumber: string }> };

// POST { courseId } — an admin with the course.student.enlist scope adds a delisted student back to a course.
// Their attendance for the course was wiped when they delisted and is NOT restored; they start fresh from the next class.
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const denied = requireScope(admin, "course.student.enlist");
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

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) return NextResponse.json({ error: "Course not found." }, { status: 404 });

    // A course on the student's own level just needs the delisted marker gone (the level rule takes over again).
    // An off-level course was an approved Added Course before, and a super admin is vouching for it now, so it goes
    // straight back to approved instead of making them ask again.
    const onLevel = courseVisibleToStudent(audienceOf(courseDoc.data()), reg);
    const ref = enrollmentRef(courseId, reg);

    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // Checked inside the transaction so a double tap can't relist twice
      if (!snap.exists || snap.data()?.status !== "delisted") return { error: "That student hasn't delisted this course." as const };
      const name = String(snap.data()?.name ?? "");
      if (onLevel) {
        tx.delete(ref);
      } else {
        tx.update(ref, {
          status: "approved",
          decidedAt: Date.now(),
          decidedBy: admin.uid,
          decidedByName: admin.name,
          relistedAt: Date.now(),
          delistedAt: FieldValue.delete(),
          delistedBy: FieldValue.delete(),
          delistedByName: FieldValue.delete(),
        });
      }
      return { name };
    });
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: 409 });

    await db.collection("activityLog").add({
      action: "relist_course_admin",
      courseId,
      regNumber: reg,
      studentName: outcome.name || null,
      adminUid: admin.uid,
      adminName: admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin relist error:", error);
    return NextResponse.json({ error: "Couldn't add the student back. Please try again." }, { status: 500 });
  }
}
