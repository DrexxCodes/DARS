import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

interface AdminUser {
  uid: string;
  admin: boolean;
  scope?: "super" | "defined";
  [key: string]: unknown;
}

interface Course {
  id: string;
  name: string;
  code: string;
  assignedAdmins?: string[];
  totalClasses?: number;
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

    const studentsSnap = await db.collection("students").orderBy("regNumber", "asc").get();
    const students: Student[] = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));

    let coursesSnap: Course[];
    if (courseId) {
      const doc = await db.collection("courses").doc(courseId).get();
      coursesSnap = doc.exists ? [{ id: doc.id, ...doc.data() } as Course] : [];
    } else {
      const snap = await db.collection("courses").get();
      coursesSnap = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
    }

    const courses = adminUser.scope === "defined"
      ? coursesSnap.filter((c) => ((c.assignedAdmins as string[]) || []).includes(adminUser.uid))
      : coursesSnap;

    // rows shape: one row per student per course per class session
    // attended cell is "Present" | "Absent" so the client can colour it
    const rows: Record<string, unknown>[] = [];

    for (const course of courses) {
      // Fetch all sessions for this course ordered chronologically
      const sessionsSnap = await db
        .collection("classes").doc(course.id).collection("sessions")
        .orderBy("createdAt", "asc").get();

      for (const student of students) {
        for (const sessionDoc of sessionsSnap.docs) {
          const s = sessionDoc.data();
          const classId = sessionDoc.id;

          const recordDoc = await db
            .collection("students").doc(student.id)
            .collection("attendance").doc(course.id)
            .collection("records").doc(classId).get();

          const present = recordDoc.exists;

          rows.push({
            regNumber: student.id,
            studentName: student.name ?? "",
            courseCode: course.code,
            courseName: course.name,
            classDate: s.date ?? s.dateKey ?? "",
            classId,
            // "Present" / "Absent" lets the frontend/client apply colours
            attended: present ? "Present" : "Absent",
            late: present ? (recordDoc.data()?.late ? "Yes" : "No") : "-",
            markedAt: present
              ? new Date(recordDoc.data()!.timestamp as number).toLocaleTimeString()
              : "-",
          });
        }
      }
    }

    return NextResponse.json({ rows, courses, studentCount: students.length });
  } catch (error) {
    console.error("Bulk export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
