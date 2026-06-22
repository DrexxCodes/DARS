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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regNumber: string }> }
) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const { regNumber } = await params;

    const studentDoc = await db.collection("students").doc(regNumber).get();
    if (!studentDoc.exists) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const student = studentDoc.data()!;

    const coursesSnap = await db.collection("courses").get();
    const courses: Course[] = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));

    const rows: Record<string, unknown>[] = [];

    for (const course of courses) {
      if (adminUser.scope === "defined") {
        const assigned = (course.assignedAdmins as string[]) || [];
        if (!assigned.includes(adminUser.uid)) continue;
      }

      const sessionsSnap = await db
        .collection("classes").doc(course.id).collection("sessions")
        .orderBy("createdAt", "asc").get();

      for (const sessionDoc of sessionsSnap.docs) {
        const s = sessionDoc.data();
        const classId = sessionDoc.id;

        const recordDoc = await db
          .collection("students").doc(regNumber)
          .collection("attendance").doc(course.id)
          .collection("records").doc(classId).get();

        const present = recordDoc.exists;

        rows.push({
          regNumber,
          studentName: student.name ?? "",
          courseCode: course.code,
          courseName: course.name,
          classDate: s.date ?? s.dateKey ?? "",
          classId,
          attended: present ? "Present" : "Absent",
          late: present ? (recordDoc.data()?.late ? "Yes" : "No") : "-",
          markedAt: present
            ? new Date(recordDoc.data()!.timestamp as number).toLocaleTimeString()
            : "-",
        });
      }
    }

    return NextResponse.json({ rows, student });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
