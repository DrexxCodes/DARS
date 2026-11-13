import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { courseVisibleToStudent } from "@/lib/admission";
import { enrollmentStatuses, isEnrolled } from "@/lib/enrollment";
import { loadLiveClasses } from "@/lib/live-classes";

interface Course {
  totalClasses: number;
  id: string;
  name: string;
  code: string;
  assignedAdmins?: string[];
  levels?: number[];
  departments?: string[];
  admissionTypes?: string[];
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

    // An admin looking up someone else needs the student.lookup scope (a student reading their own record doesn't)
    const isSelfLookup = user.regNumber === regNumber;
    if (user.admin && !isSelfLookup) {
      const denied = requireScope({ uid: decoded.uid, ...user } as Parameters<typeof requireScope>[0], "student.lookup");
      if (denied) return denied;
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
    // The device link is stored as hashes; admins only need to know whether there is one and since when.
    const { boundDevice, ...studentData } = studentDoc.data()!;
    // Login details for admins who are looking someone else up: email and whether the account is disabled
    let account: { uid: string | null; email: string; disabled: boolean; isAdmin: boolean } | null = null;
    if (user.admin && !isSelfLookup) {
      const uid = (studentData.uid as string | undefined) ?? null;
      let email = typeof studentData.email === "string" ? studentData.email : "";
      let disabled = false;
      let isAdmin = false;
      if (uid) {
        const [authUser, linkedUser] = await Promise.all([auth.getUser(uid).catch(() => null), db.collection("users").doc(uid).get()]);
        if (authUser) {
          email = authUser.email ?? email;
          disabled = authUser.disabled;
        }
        disabled = disabled || linkedUser.data()?.banned === true;
        isAdmin = linkedUser.data()?.admin === true;
      }
      account = { uid, email, disabled, isAdmin };
    }
    const student = {
      ...studentData,
      deviceLinked: typeof boundDevice?.did === "string",
      deviceLinkedAt: typeof boundDevice?.boundAt === "number" ? (boundDevice.boundAt as number) : null,
    };
    // The login uid is internal: admins get what they need through `account`
    delete (student as Record<string, unknown>).uid;

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

    const isDefinedAdmin = user.admin && user.scope === "defined";
    const isSelf = user.regNumber === regNumber;
    const inView = (c: Course) => !isDefinedAdmin || (c.assignedAdmins || []).includes(decoded.uid);

    // Where the student stands in each course, in one batched read: delisted, approved Added Course, or nothing on file.
    // Only courses this caller can see are read, so scoped admins pay for nothing extra. A student's own view needs every
    // course, because a delisted course has to disappear even when it's on their level.
    const statuses = await enrollmentStatuses(courses.filter((c) => isSelf || inView(c)).map((c) => c.id), regNumber);
    const delisted = (c: Course) => statuses.get(c.id) === "delisted";
    // Does the student actually take the course? Their level/department/admission type or an approved Added Course, and not delisted.
    const enrolled = (c: Course) => isEnrolled(courseVisibleToStudent(c, regNumber), statuses.get(c.id));

    // A student's own dashboard shows only the courses they take. (Admins looking a student up still see every course, as before.)
    if (isSelf) courses = courses.filter(enrolled);
    const offered = (c: Course) => isSelf || enrolled(c);

    // Classes running right now (one cached query). A class in progress that the student hasn't marked yet isn't an
    // absence: it's left out of their total until they mark or the class ends.
    const live = await loadLiveClasses();

    const attendanceData = await Promise.all(
      courses.map(async (course) => {
        if (!inView(course)) {
          // Return locked entry — no Firestore reads needed
          return {
            courseId: course.id,
            courseName: course.name,
            courseCode: course.code,
            attended: 0,
            total: 0,
            percentage: 0,
            locked: true, // scoped admin cannot see this
            offered: false,
            delisted: false,
            pendingClass: false,
          };
        }

        if (delisted(course)) {
          // Their records for it were wiped when they delisted, so there's nothing to count
          return {
            courseId: course.id,
            courseName: course.name,
            courseCode: course.code,
            attended: 0,
            total: 0,
            percentage: 0,
            locked: false,
            offered: false,
            delisted: true,
            pendingClass: false,
          };
        }

        const recordsCol = db
          .collection("students").doc(regNumber)
          .collection("attendance").doc(course.id)
          .collection("records");
        const liveClass = offered(course) ? live.get(course.id) : undefined;

        // Server-side count: Firestore bills 1 read per 1,000 matching records (minimum 1) instead of 1 per record,
        // and the number is exactly what reading every record and taking .size would give.
        const [countSnap, liveMark] = await Promise.all([
          recordsCol.count().get(),
          liveClass ? recordsCol.doc(liveClass.classId).get() : Promise.resolve(null),
        ]);

        const pendingClass = !!liveClass && !liveMark?.exists;
        // Use denormalized counter, minus the class still waiting on this student
        const total: number = Math.max(0, (course.totalClasses ?? 0) - (pendingClass ? 1 : 0));
        const attended = countSnap.data().count;

        return {
          courseId: course.id,
          courseName: course.name,
          courseCode: course.code,
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
          locked: false,
          offered: offered(course),
          delisted: false,
          pendingClass,
        };
      })
    );

    // Overall rate across the courses the student offers (and the admin can see): total attended / total held.
    const counted = attendanceData.filter((c) => !c.locked && c.offered);
    const overallAttended = counted.reduce((n, c) => n + c.attended, 0);
    const overallTotal = counted.reduce((n, c) => n + c.total, 0);
    const overall = {
      attended: overallAttended,
      total: overallTotal,
      percentage: overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0,
      courses: counted.length,
    };

    return NextResponse.json({
      student: { regNumber, ...student },
      account,
      courses: attendanceData,
      overall,
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
  const denied = requireScope(admin, "student.lookup"); // lookup comes with editing
  if (denied) return denied;

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
