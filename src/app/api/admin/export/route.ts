import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

interface AdminUser {
  uid: string;
  admin: boolean;
  scope?: "super" | "defined";
  assignedCourses?: string[];
  [key: string]: unknown;
}

interface Course {
  id: string;
  name: string;
  code: string;
  assignedAdmins?: string[];
}

interface Student {
  id: string;
  name: string;
  regNumber?: string;
  [key: string]: unknown;
}

async function verifyAdmin(req: NextRequest): Promise<AdminUser | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data()!;
    if (!user.admin) return null;
    return { uid: decoded.uid, ...user } as AdminUser;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    // Get all students
    const studentsSnap = await db.collection("students").orderBy("regNumber", "asc").get();
    const students: Student[] = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));

    // Get courses (scoped to admin if defined)
    let coursesSnap: Course[];
    if (courseId) {
      const doc = await db.collection("courses").doc(courseId).get();
      coursesSnap = doc.exists ? [{ id: doc.id, ...doc.data() } as Course] : [];
    } else {
      const snap = await db.collection("courses").get();
      coursesSnap = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
    }

    // Scope filter for defined admins
    const courses = adminUser.scope === "defined"
      ? coursesSnap.filter((c) => ((c.assignedAdmins as string[]) || []).includes(adminUser.uid))
      : coursesSnap;

    const rows: Record<string, unknown>[] = [];

    for (const student of students) {
      for (const course of courses) {
        const sessionsSnap = await db
          .collection("classes").doc(course.id).collection("sessions")
          .orderBy("createdAt", "asc").get();

        const totalSessions = sessionsSnap.size;
        let attended = 0;
        let lateCount = 0;

        for (const session of sessionsSnap.docs) {
          const s = session.data();
          const recordDoc = await db
            .collection("students").doc(student.id)
            .collection("attendance").doc(course.id)
            .collection("records").doc(s.dateKey).get();

          if (recordDoc.exists) {
            attended++;
            if (recordDoc.data()?.late) lateCount++;
          }

          rows.push({
            regNumber: student.id,
            studentName: student.name,
            courseCode: course.code,
            courseName: course.name,
            classDate: s.dateKey,
            attended: recordDoc.exists ? "Yes" : "No",
            late: recordDoc.exists ? (recordDoc.data()?.late ? "Yes" : "No") : "-",
            markedAt: recordDoc.exists
              ? new Date(recordDoc.data()?.timestamp).toLocaleTimeString()
              : "-",
          });
        }

        // Summary row per student per course
        void attended; void lateCount; void totalSessions;
      }
    }

    return NextResponse.json({ rows, courses, studentCount: students.length });
  } catch (error) {
    console.error("Bulk export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}