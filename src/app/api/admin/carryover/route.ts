import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, getAccessibleCourses } from "@/lib/admin-auth";
import { enrollmentRef, enrollmentsCol } from "@/lib/enrollment";
import { levelOf } from "@/lib/admission";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import type { CarryoverRequest } from "@/types/admin";

async function resolveCourse(req: NextRequest, courseId: unknown) {
  const admin = await verifyAdmin(req);
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
    return { error: NextResponse.json({ error: "courseId is required." }, { status: 400 }) };
  }
  // Super admins: any course. Scoped admins: only the courses they're assigned to.
  const [course] = await getAccessibleCourses(admin, courseId);
  if (!course) return { error: NextResponse.json({ error: "You don't have access to that course." }, { status: 403 }) };
  return { admin, course };
}

// GET ?courseId= — pending applications and approved carry-overs for the course
export async function GET(req: NextRequest) {
  try {
    const r = await resolveCourse(req, new URL(req.url).searchParams.get("courseId"));
    if ("error" in r) return r.error;

    const snap = await enrollmentsCol(r.course.id).get();
    const requests: CarryoverRequest[] = snap.docs
      .filter((d) => d.data().status === "pending" || d.data().status === "approved")
      .map((d) => ({
        regNumber: d.id,
        name: String(d.data().name ?? ""),
        level: levelOf(d.id),
        status: d.data().status as "pending" | "approved",
        requestedAt: Number(d.data().requestedAt ?? 0),
        decidedByName: (d.data().decidedByName as string | null) ?? null,
      }))
      .sort((a, b) => (a.status === b.status ? a.requestedAt - b.requestedAt : a.status === "pending" ? -1 : 1));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Carry-over requests error:", error);
    return NextResponse.json({ error: "Failed to load requests." }, { status: 500 });
  }
}

// POST { courseId, regNumber, decision: "approve" | "reject" } — "reject" also removes an approved carry-over
export async function POST(req: NextRequest) {
  try {
    const { courseId, regNumber, decision } = await req.json();
    const r = await resolveCourse(req, courseId);
    if ("error" in r) return r.error;

    const reg = typeof regNumber === "string" ? regNumber.trim().toUpperCase() : "";
    if (!REG_NUMBER_REGEX.test(reg)) return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });
    if (decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

    const ref = enrollmentRef(r.course.id, reg);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { error: "No application from that student." as const };
      const status = snap.data()!.status;
      if (decision === "approve" && status !== "pending") return { error: "That application has already been dealt with." as const };
      if (decision === "reject" && status === "rejected") return { error: "That application has already been dealt with." as const };
      tx.update(ref, {
        status: decision === "approve" ? "approved" : "rejected",
        decidedAt: Date.now(),
        decidedBy: r.admin.uid,
        decidedByName: r.admin.name,
      });
      return { name: String(snap.data()!.name ?? "") };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });

    await db.collection("activityLog").add({
      action: decision === "approve" ? "approve_carryover" : "reject_carryover",
      courseId: r.course.id,
      regNumber: reg,
      studentName: result.name,
      adminUid: r.admin.uid,
      adminName: r.admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Carry-over decision error:", error);
    return NextResponse.json({ error: "Failed to save your decision." }, { status: 500 });
  }
}
