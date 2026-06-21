import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { format } from "date-fns";

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

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { action, courseId } = await req.json();

    // Check admin is assigned to this course (or is super admin)
    if (adminUser.scope === "defined") {
      const courseDoc = await db.collection("courses").doc(courseId).get();
      if (!courseDoc.exists) return NextResponse.json({ error: "Course not found" }, { status: 404 });
      const course = courseDoc.data()!;
      if (!course.assignedAdmins?.includes(adminUser.uid)) {
        return NextResponse.json({ error: "You are not assigned to this course" }, { status: 403 });
      }
    }

    const globalRef = db.collection("globals").doc(courseId);
    const now = Date.now();
    const dateKey = format(new Date(), "yyyy-MM-dd");

    if (action === "start") {
      const globalDoc = await globalRef.get();
      if (globalDoc.data()?.classActive) {
        return NextResponse.json({ error: "A class is already active for this course." }, { status: 400 });
      }

      const startTime = now;
      const endTime = now + 2 * 60 * 60 * 1000;

      // Create session document
      const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(dateKey);
      await sessionRef.set({
        courseId,
        dateKey,
        startTime,
        endTime,
        totalPresence: 0,
        startedBy: adminUser.uid,
        createdAt: now,
      }, { merge: true });

      // Update globals
      await globalRef.update({
        classActive: true,
        checkinPaused: false,
        currentDate: dateKey,
        startTime,
        endTime,
      });

      // Log activity
      await db.collection("activityLog").add({
        action: "start_class",
        courseId,
        dateKey,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true, startTime, endTime, dateKey });

    } else if (action === "end") {
      await globalRef.update({
        classActive: false,
        checkinPaused: false,
        startTime: null,
        endTime: null,
      });

      await db.collection("activityLog").add({
        action: "end_class",
        courseId,
        dateKey,
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
        dateKey,
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
        dateKey,
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }

    // Get all sessions for a course
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