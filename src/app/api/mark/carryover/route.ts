import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { admissionTypeOf, courseVisibleToAdmissionType, courseVisibleToDepartment, courseVisibleToStudent, departmentOf } from "@/lib/admission";
import { audienceOf, enrollmentRef } from "@/lib/enrollment";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import type { CarryoverEntry, CarryoverStatus } from "@/types/mark";

async function getStudentCaller(req: NextRequest) {
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
  return { uid, reg, name: String(userDoc.data()?.name ?? "") };
}

// GET — every active course outside the caller's level, with their carry-over status for each
export async function GET(req: NextRequest) {
  try {
    const me = await getStudentCaller(req);
    if ("error" in me) return me.error;

    const department = departmentOf(me.reg);
    const coursesSnap = await db.collection("courses").where("active", "==", true).get();
    // Courses of their own department and admission type that aren't for their level. Carry-overs don't cross either.
    const admissionType = admissionTypeOf(me.reg);
    const others = coursesSnap.docs.filter((d) => {
      const a = audienceOf(d.data());
      return courseVisibleToDepartment(a.departments, department) && courseVisibleToAdmissionType(a.admissionTypes, admissionType) && !courseVisibleToStudent(a, me.reg);
    });

    const enrolSnaps = others.length ? await db.getAll(...others.map((d) => enrollmentRef(d.id, me.reg))) : [];
    const entries: CarryoverEntry[] = others.map((d, i) => {
      const e = enrolSnaps[i];
      return {
        courseId: d.id,
        code: String(d.data().code ?? ""),
        name: String(d.data().name ?? ""),
        levels: Array.isArray(d.data().levels) ? (d.data().levels as number[]) : [],
        status: (e.exists ? e.data()?.status : "none") as CarryoverStatus,
      };
    });
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Carry-over list error:", error);
    return NextResponse.json({ error: "Failed to load courses." }, { status: 500 });
  }
}

// POST { courseId } — apply for a carry-over course. An admin of that course has to approve it.
export async function POST(req: NextRequest) {
  try {
    const me = await getStudentCaller(req);
    if ("error" in me) return me.error;
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

    if (outcome === "approved") return NextResponse.json({ error: "You're already approved for this course." }, { status: 409 });
    if (outcome === "pending") return NextResponse.json({ error: "You've already applied. Waiting for approval." }, { status: 409 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Carry-over apply error:", error);
    return NextResponse.json({ error: "Failed to submit your application." }, { status: 500 });
  }
}
