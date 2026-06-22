import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

interface AdminUser {
  uid: string;
  admin: boolean;
  name: string;
  scope?: "super" | "defined";
  assignedCourses?: string[];
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

// ─── POST: start | end | pause | resume ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { action, courseId, locationId } = await req.json();

    if (adminUser.scope === "defined") {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      if (!courseDoc.exists) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      if (!courseDoc.data()!.assignedAdmins?.includes(adminUser.uid)) {
        return NextResponse.json({ error: "You are not assigned to this course" }, { status: 403 });
      }
    }

    const globalRef = db.collection("globals").doc(courseId);
    const now = Date.now();

    if (action === "start") {
      const globalDoc = await globalRef.get();
      if (globalDoc.data()?.classActive) {
        return NextResponse.json({ error: "A class is already active for this course." }, { status: 400 });
      }

      // Resolve location
      const locationsCol = db.collection("globals").doc("locationConfig").collection("locations");
      let locationDoc;
      if (locationId) {
        locationDoc = await locationsCol.doc(locationId).get();
        if (!locationDoc.exists) {
          return NextResponse.json({ error: "Selected location no longer exists." }, { status: 400 });
        }
      } else {
        const primarySnap = await locationsCol.where("isPrimary", "==", true).limit(1).get();
        if (primarySnap.empty) {
          return NextResponse.json(
            { error: "No location tags exist yet. Create one on the Tags page first." },
            { status: 400 }
          );
        }
        locationDoc = primarySnap.docs[0];
      }
      const location = locationDoc.data()!;

      const endTime = now + 2 * 60 * 60 * 1000;

      // Auto-generate a unique class ID (so same course can run multiple days)
      const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc();
      const classId = sessionRef.id;

      await sessionRef.set({
        classId,
        courseId,
        date: new Date().toISOString().split("T")[0], // stored for display/grouping
        startTime: now,
        endTime,
        totalPresence: 0,
        startedBy: adminUser.uid,
        createdAt: now,
        locationId: locationDoc.id,
        locationName: location.name,
      });

      // Increment totalClasses counter on the course doc
      await db.collection("courses").doc(courseId).update({
        totalClasses: FieldValue.increment(1),
      });

      // Update globals — currentClassId drives all mark-page logic
      await globalRef.update({
        classActive: true,
        checkinPaused: false,
        currentClassId: classId,
        startTime: now,
        endTime,
        locationId: locationDoc.id,
        locationName: location.name,
      });

      await db.collection("activityLog").add({
        action: "start_class",
        courseId,
        classId,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true, classId, startTime: now, endTime, locationName: location.name });

    } else if (action === "end") {
      await globalRef.update({
        classActive: false,
        checkinPaused: false,
        currentClassId: null,
        startTime: null,
        endTime: null,
      });

      await db.collection("activityLog").add({
        action: "end_class",
        courseId,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true });

    } else if (action === "pause") {
      await globalRef.update({ checkinPaused: true });
      await db.collection("activityLog").add({
        action: "pause_checkin",
        courseId,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });
      return NextResponse.json({ success: true });

    } else if (action === "resume") {
      await globalRef.update({ checkinPaused: false });
      await db.collection("activityLog").add({
        action: "resume_checkin",
        courseId,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Class action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}

// ─── GET: list sessions for a course ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }

    const snap = await db
      .collection("classes")
      .doc(courseId)
      .collection("sessions")
      .orderBy("createdAt", "desc")
      .get();

    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Get classes error:", error);
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }
}

// ─── Batch delete helper ───────────────────────────────────────────────────────
async function deleteInBatches(refs: FirebaseFirestore.DocumentReference[]) {
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// ─── DELETE: remove a single class session OR an entire course ────────────────
//
//  Body shapes:
//    { courseId, classId }  → delete one session + its student attendance records
//    { courseId }           → delete the entire course (super admin only)
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser || adminUser.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  try {
    const { courseId, classId } = await req.json();
    if (!courseId) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

    // ── Delete a single class session ──────────────────────────────────────────
    if (classId) {
      const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(classId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });

      const sessionData = sessionDoc.data()!;
      const now = Date.now();

      // Find every student who has an attendance record keyed by this classId
      // Records are stored at students/{reg}/attendance/{courseId}/records/{classId}
      const studentsSnap = await db.collection("students").get();
      const attendanceRefs: FirebaseFirestore.DocumentReference[] = [];

      for (const studentDoc of studentsSnap.docs) {
        const recordRef = studentDoc.ref
          .collection("attendance")
          .doc(courseId)
          .collection("records")
          .doc(classId);
        const recordSnap = await recordRef.get();
        if (recordSnap.exists) {
          attendanceRefs.push(recordRef);
          // Decrement the student's totalPresence
          await studentDoc.ref.update({ totalPresence: FieldValue.increment(-1) });
        }
      }

      if (attendanceRefs.length) await deleteInBatches(attendanceRefs);

      // Delete the session itself
      await sessionRef.delete();

      // Decrement totalClasses on the course doc
      await db.collection("courses").doc(courseId).update({
        totalClasses: FieldValue.increment(-1),
      });

      await db.collection("activityLog").add({
        action: "delete_class",
        courseId,
        classId,
        date: sessionData.date,
        studentsAffected: attendanceRefs.length,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true, studentsAffected: attendanceRefs.length });
    }

    // ── Delete the entire course ───────────────────────────────────────────────
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    // 1. Delete all sessions
    const sessionsSnap = await db.collection("classes").doc(courseId).collection("sessions").get();
    await deleteInBatches(sessionsSnap.docs.map((d) => d.ref));
    await db.collection("classes").doc(courseId).delete().catch(() => {});

    // 2. Delete globals doc
    await db.collection("globals").doc(courseId).delete().catch(() => {});

    // 3. Delete activityLog entries
    const logSnap = await db.collection("activityLog").where("courseId", "==", courseId).get();
    await deleteInBatches(logSnap.docs.map((d) => d.ref));

    // 4. Delete every student's attendance for this course
    const studentsSnap = await db.collection("students").get();
    const attendanceRefs: FirebaseFirestore.DocumentReference[] = [];
    for (const studentDoc of studentsSnap.docs) {
      const recordsSnap = await studentDoc.ref
        .collection("attendance")
        .doc(courseId)
        .collection("records")
        .get();
      recordsSnap.docs.forEach((r) => attendanceRefs.push(r.ref));
      attendanceRefs.push(studentDoc.ref.collection("attendance").doc(courseId));
    }
    if (attendanceRefs.length) await deleteInBatches(attendanceRefs);

    // 5. Delete the course doc
    await courseRef.delete();

    await db.collection("activityLog").add({
      action: "delete_course",
      courseId,
      courseName: courseDoc.data()?.name || courseId,
      adminUid: adminUser.uid,
      adminName: adminUser.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
