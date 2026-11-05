import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { admissionTypeOf, courseVisibleToAdmissionType, courseVisibleToDepartment, courseVisibleToStudent, departmentOf } from "@/lib/admission";
import { audienceOf, enrollmentRef, enrollmentStatuses } from "@/lib/enrollment";
import { getStudentCaller } from "@/lib/student-auth";
import { BIRTHDAY_REQUIRED_CODE } from "@/constants/birthday";
import type { CarryoverEntry, CarryoverStatus } from "@/types/mark";

// GET — the courses the student can add (every active course of their department and admission type that isn't on their
// level), with where each request stands, plus any course they've delisted (level or not) so the app can hide it.
export async function GET(req: NextRequest) {
  try {
    const me = await getStudentCaller(req);
    if ("error" in me) return me.error;

    const department = departmentOf(me.reg);
    const admissionType = admissionTypeOf(me.reg);
    const coursesSnap = await db.collection("courses").where("active", "==", true).get();
    const mine = coursesSnap.docs.filter((d) => {
      const a = audienceOf(d.data());
      return courseVisibleToDepartment(a.departments, department) && courseVisibleToAdmissionType(a.admissionTypes, admissionType);
    });

    const statuses = await enrollmentStatuses(mine.map((d) => d.id), me.reg);
    const entries: CarryoverEntry[] = mine
      .filter((d) => !courseVisibleToStudent(audienceOf(d.data()), me.reg) || statuses.get(d.id) === "delisted")
      .map((d) => ({
        courseId: d.id,
        code: String(d.data().code ?? ""),
        name: String(d.data().name ?? ""),
        levels: Array.isArray(d.data().levels) ? (d.data().levels as number[]) : [],
        status: (statuses.get(d.id) ?? "none") as CarryoverStatus,
      }));
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Added course list error:", error);
    return NextResponse.json({ error: "Failed to load courses." }, { status: 500 });
  }
}

// POST { courseId } — ask to add a course from another level (an "Added Course"). An admin of that course has to approve it.
export async function POST(req: NextRequest) {
  try {
    const me = await getStudentCaller(req);
    if ("error" in me) return me.error;
    if (!me.birthday) {
      return NextResponse.json({ error: "Add your birthday to continue.", code: BIRTHDAY_REQUIRED_CODE }, { status: 403 });
    }
    if (!rateLimit(`carryover:${me.uid}`, 10, 60_000).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
    }

    const { courseId } = await req.json();
    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "Course is required." }, { status: 400 });
    }

    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists || courseDoc.data()?.active === false) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    const audience = audienceOf(courseDoc.data());
    if (!courseVisibleToDepartment(audience.departments, departmentOf(me.reg))) {
      return NextResponse.json({ error: "This course isn't offered to your department." }, { status: 403 });
    }
    if (!courseVisibleToAdmissionType(audience.admissionTypes, admissionTypeOf(me.reg))) {
      return NextResponse.json({ error: "This course isn't offered to your admission type." }, { status: 403 });
    }
    if (courseVisibleToStudent(audience, me.reg)) {
      return NextResponse.json({ error: "This course is already part of your level." }, { status: 400 });
    }

    const ref = enrollmentRef(courseId, me.reg);
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const status = snap.data()?.status;
      if (status === "delisted") return "delisted" as const; // a delisted course stays delisted; never overwrite it with a new request
      if (status === "approved") return "approved" as const;
      if (status === "pending") return "pending" as const;
      tx.set(ref, {
        regNumber: me.reg,
        name: me.name,
        uid: me.uid,
        status: "pending",
        requestedAt: Date.now(),
        decidedAt: null,
        decidedBy: null,
        decidedByName: null,
      });
      return "created" as const;
    });

    if (outcome === "delisted") return NextResponse.json({ error: "You delisted this course, so it can't be added again." }, { status: 409 });
    if (outcome === "approved") return NextResponse.json({ error: "You've already added this course." }, { status: 409 });
    if (outcome === "pending") return NextResponse.json({ error: "You've already asked to add this course. Waiting for approval." }, { status: 409 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Add course error:", error);
    return NextResponse.json({ error: "Failed to send your request." }, { status: 500 });
  }
}
