import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { courseVisibleToStudent } from "@/lib/admission";
import { enrollmentRef } from "@/lib/enrollment";

interface Course {
  totalClasses: number;
  id: string;
  name: string;
  code: string;
  assignedAdmins?: string[];
  levels?: number[];
  departments?: string[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regNumber: string }> }
) {
  try {
    const { regNumber } = await params;
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const user = userDoc.data()!;

    if (!user.admin && user.regNumber !== regNumber) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.admin && user.scope === "defined" && courseId) {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const course = courseDoc.data();
      if (!course?.assignedAdmins?.includes(decoded.uid)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const studentDoc = await db.collection("students").doc(regNumber).get();
    if (!studentDoc.exists) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const student = studentDoc.data()!;

    if (courseId) {
      const recordsSnap = await db
        .collection("students").doc(regNumber)
        .collection("attendance").doc(courseId)
        .collection("records")
        .orderBy("timestamp", "asc").get();
      const records = recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Use denormalized totalClasses from course doc — cheap single read
      const courseDoc = await db.collection("courses").doc(courseId).get();
      const totalSessions: number = courseDoc.data()?.totalClasses ?? 0;

      return NextResponse.json({
        student: { regNumber, ...student },
        records,
        totalSessions,
        attendedSessions: records.length,
        percentage: totalSessions > 0 ? Math.round((records.length / totalSessions) * 100) : 0,
      });
    }

    // Across all courses — show all courses, mark which ones the admin can see
    const coursesSnap = await db.collection("courses").get();
    let courses: Course[] = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));

    // A student's own dashboard shows only their courses: their level's, plus approved carry-overs.
    // (Admins looking a student up still see every course, as before.)
    if (user.regNumber === regNumber) {
      const offLevel = courses.filter((c) => !courseVisibleToStudent(c, regNumber));
      const enrol = offLevel.length ? await db.getAll(...offLevel.map((c) => enrollmentRef(c.id, regNumber))) : [];
      const approved = new Set(offLevel.filter((_, i) => enrol[i].exists && enrol[i].data()?.status === "approved").map((c) => c.id));
      courses = courses.filter((c) => courseVisibleToStudent(c, regNumber) || approved.has(c.id));
    }

    const isDefinedAdmin = user.admin && user.scope === "defined";

    const attendanceData = await Promise.all(
      courses.map(async (course) => {
        const isAssigned = !isDefinedAdmin || (course.assignedAdmins || []).includes(decoded.uid);

        if (!isAssigned) {
          // Return locked entry — no Firestore reads needed
          return {
            courseId: course.id,
            courseName: course.name,
            courseCode: course.code,
            attended: 0,
            total: 0,
            percentage: 0,
            locked: true, // scoped admin cannot see this
          };
        }

        const recordsSnap = await db
          .collection("students").doc(regNumber)
          .collection("attendance").doc(course.id)
          .collection("records").get();

        // Use denormalized counter
        const total: number = course.totalClasses ?? 0;
        const attended = recordsSnap.size;

        return {
          courseId: course.id,
          courseName: course.name,
          courseCode: course.code,
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
          locked: false,
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

// PATCH { name } — any admin can correct a student's name (e.g. a typo made at sign-up)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ regNumber: string }> }
) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const reg = (await params).regNumber.trim().toUpperCase();
    if (!REG_NUMBER_REGEX.test(reg)) return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Name must be between 2 and 100 characters." }, { status: 400 });
    }

    const studentRef = db.collection("students").doc(reg);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const previous = (studentDoc.data()!.name as string | undefined) ?? null;
    if (previous === name) return NextResponse.json({ success: true, name });

    // Keep the linked login account in step so the student sees the same name everywhere
    let uid: string | undefined = studentDoc.data()!.uid;
    if (!uid) {
      const linked = await db.collection("users").where("regNumber", "==", reg).limit(1).get();
      uid = linked.docs[0]?.id;
    }

    const batch = db.batch();
    batch.update(studentRef, { name });
    if (uid) batch.set(db.collection("users").doc(uid), { name }, { merge: true });
    await batch.commit();
    if (uid) await auth.updateUser(uid, { displayName: name }).catch(() => {}); // cosmetic; never fail the edit over it

    await db.collection("activityLog").add({
      action: "edit_student_name",
      regNumber: reg,
      previousName: previous,
      newName: name,
      adminUid: admin.uid,
      adminName: admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, name });
  } catch (error) {
    console.error("Edit student name error:", error);
    return NextResponse.json({ error: "Failed to update name." }, { status: 500 });
  }
}
