import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, getAccessibleCourses } from "@/lib/admin-auth";
import { admissionTypeOf, courseVisibleToStudent, departmentOf, isValidRegNumber } from "@/lib/admission";
import { ADMISSION_TYPES, DEPARTMENTS } from "@/constants/academics";
import { audienceOf, enrollmentsCol } from "@/lib/enrollment";
import { excludedRegNumbers } from "@/lib/export-exclusion";
import type { CourseExportData, ExportRecord, ExportSession, ExportStudent } from "@/types/admin";

export const maxDuration = 60;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CHUNK = 40; // students read in parallel

/**
 * GET /api/admin/export?courseId=…[&date=YYYY-MM-DD]
 *
 * Returns the raw attendance data for one course (all its classes, or only the classes held on `date`).
 * The PDF itself is built in the browser. The student list is strict: the course's levels plus approved carry-overs. Super admins can export any course; scoped admins only their own.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const q = new URL(req.url).searchParams;
    const courseId = q.get("courseId");
    const date = q.get("date");

    if (!courseId || courseId.includes("/")) return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    if (date && !DATE_REGEX.test(date)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

    const [course] = await getAccessibleCourses(admin, courseId);
    if (!course) return NextResponse.json({ error: "You don't have access to that course." }, { status: 403 });

    const [courseDoc, sessionsSnap, studentsSnap, approvedSnap, excluded] = await Promise.all([
      db.collection("courses").doc(courseId).get(),
      db.collection("classes").doc(courseId).collection("sessions").orderBy("createdAt", "asc").get(),
      db.collection("students").select("name").get(),
      enrollmentsCol(courseId).where("status", "==", "approved").get(),
      excludedRegNumbers(),
    ]);

    const audience = audienceOf(courseDoc.data());

    const sessions: ExportSession[] = sessionsSnap.docs
      .map((d) => {
        const s = d.data();
        return {
          id: d.id,
          date: String(s.date ?? ""),
          startTime: Number(s.startTime ?? s.createdAt ?? 0),
          endTime: Number(s.endTime ?? 0),
          locationName: (s.locationName as string | undefined) ?? null,
        };
      })
      .filter((s) => !date || s.date === date);

    const payloadBase = { course };
    if (sessions.length === 0) {
      return NextResponse.json({ ...payloadBase, sessions, students: [], records: {} } satisfies CourseExportData);
    }
    const sessionIds = new Set(sessions.map((s) => s.id));

    // Strict roster: only students the course is for. That's the course's levels, departments and admission types
    // (everyone if none are set) plus students with an approved carry-over. Other students never appear, even if they
    // have a record. A reg number that isn't valid (or whose department/admission type can't be read) is in no PDF.
    const carryovers = new Set(approvedSnap.docs.map((d) => d.id));
    const rank = <T extends { id: string }>(list: readonly T[], id: string | null) => {
      const i = list.findIndex((x) => x.id === id);
      return i === -1 ? list.length : i;
    };
    const toRead: ExportStudent[] = studentsSnap.docs
      .filter((d) => isValidRegNumber(d.id))
      .filter((d) => !excluded.has(d.id.toUpperCase())) // admins who opted out of exports
      .filter((d) => courseVisibleToStudent(audience, d.id) || carryovers.has(d.id))
      .map((d) => ({
        regNumber: d.id,
        name: String(d.data().name ?? ""),
        department: departmentOf(d.id)!,
        admissionType: admissionTypeOf(d.id)!,
      }));

    const records: Record<string, Record<string, ExportRecord>> = {};

    for (let i = 0; i < toRead.length; i += CHUNK) {
      await Promise.all(
        toRead.slice(i, i + CHUNK).map(async (c) => {
          const snap = await db
            .collection("students").doc(c.regNumber)
            .collection("attendance").doc(courseId)
            .collection("records").get();
          for (const r of snap.docs) {
            if (!sessionIds.has(r.id)) continue;
            const data = r.data();
            (records[c.regNumber] ??= {})[r.id] = {
              timestamp: Number(data.timestamp ?? 0),
              late: !!data.late,
              manual: !!data.manual,
            };
          }
        })
      );
    }

    // Grouped by department (Political Science, then Education), Regular before CEP, then reg number.
    const students: ExportStudent[] = toRead.sort(
      (a, b) =>
        rank(DEPARTMENTS, a.department) - rank(DEPARTMENTS, b.department) ||
        rank(ADMISSION_TYPES, a.admissionType) - rank(ADMISSION_TYPES, b.admissionType) ||
        a.regNumber.localeCompare(b.regNumber)
    );

    return NextResponse.json({ ...payloadBase, sessions, students, records } satisfies CourseExportData);
  } catch (error) {
    console.error("Attendance export error:", error);
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
