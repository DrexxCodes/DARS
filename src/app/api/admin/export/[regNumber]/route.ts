import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data()!;
    if (!user.admin) return null;
    return { uid: decoded.uid, ...user };
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
    const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));

    const rows: Record<string, unknown>[] = [];

    for (const course of courses) {
      // Scope check for defined admins
      if (adminUser.scope === "defined") {
        const assigned = (course.assignedAdmins as string[]) || [];
        if (!assigned.includes(adminUser.uid)) continue;
      }

      const sessionsSnap = await db
        .collection("classes").doc(course.id).collection("sessions")
        .orderBy("createdAt", "asc").get();

      for (const session of sessionsSnap.docs) {
        const s = session.data();
        const recordDoc = await db
          .collection("students").doc(regNumber)
          .collection("attendance").doc(course.id)
          .collection("records").doc(s.dateKey).get();

        rows.push({
          regNumber,
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
    }

    return NextResponse.json({ rows, student });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
