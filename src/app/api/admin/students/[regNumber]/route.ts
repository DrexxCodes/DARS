import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

interface Course {
  id: string;
  name: string;
  code: string;
  assignedAdmins?: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regNumber: string }> }
) {
  try {
    const { regNumber } = await params;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    // Verify token
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = userDoc.data()!;

    // Students can only see their own records
    if (!user.admin && user.regNumber !== regNumber) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Defined admins can only see courses they're assigned to
    if (user.admin && user.scope === "defined" && courseId) {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const course = courseDoc.data();
      if (!course?.assignedAdmins?.includes(decoded.uid)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const studentDoc = await db.collection("students").doc(regNumber).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const student = studentDoc.data()!;

    if (courseId) {
      // Get attendance for a specific course
      const recordsSnap = await db
        .collection("students")
        .doc(regNumber)
        .collection("attendance")
        .doc(courseId)
        .collection("records")
        .orderBy("timestamp", "asc")
        .get();

      const records = recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Get total sessions for this course
      const sessionsSnap = await db
        .collection("classes")
        .doc(courseId)
        .collection("sessions")
        .get();

      const totalSessions = sessionsSnap.size;

      return NextResponse.json({
        student: { regNumber, ...student },
        records,
        totalSessions,
        attendedSessions: records.length,
        percentage: totalSessions > 0 ? Math.round((records.length / totalSessions) * 100) : 0,
      });
    }

    // Get attendance across all courses
    const coursesSnap = await db.collection("courses").get();
    const courses: Course[] = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));

    const attendanceData = await Promise.all(
      courses.map(async (course) => {
        const recordsSnap = await db
          .collection("students")
          .doc(regNumber)
          .collection("attendance")
          .doc(course.id)
          .collection("records")
          .get();

        const sessionsSnap = await db
          .collection("classes")
          .doc(course.id)
          .collection("sessions")
          .get();

        const attended = recordsSnap.size;
        const total = sessionsSnap.size;

        return {
          courseId: course.id,
          courseName: course.name,
          courseCode: course.code,
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
        };
      })
    );

    return NextResponse.json({
      student: { regNumber, ...student },
      courses: attendanceData,
    });
  } catch (error) {
    console.error("Student attendance error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}