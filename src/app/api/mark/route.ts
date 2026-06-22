import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { REG_NUMBER_REGEX, isClassExpired, isLateAttendance } from "@/lib/utils";
import { distanceInMeters } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed } = rateLimit(ip, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "You must sign in to mark attendance.", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Please sign in again.", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const caller = callerDoc.data()!;

    const { courseId, lat, lng, regNumber: targetRegNumber } = await req.json();
    if (!courseId) return NextResponse.json({ error: "Course is required." }, { status: 400 });

    let normalized: string;
    if (targetRegNumber) {
      if (!caller.admin) {
        return NextResponse.json({ error: "Only an admin can mark attendance for another student.", code: "FORBIDDEN" }, { status: 403 });
      }
      normalized = String(targetRegNumber).trim().toUpperCase();
    } else {
      if (!caller.regNumber) return NextResponse.json({ error: "Your account has no registration number on file." }, { status: 400 });
      normalized = caller.regNumber;
    }

    if (!REG_NUMBER_REGEX.test(normalized)) {
      return NextResponse.json({ error: "Invalid registration number format." }, { status: 400 });
    }

    // 1. Fetch globals
    const globalDoc = await db.collection("globals").doc(courseId).get();
    if (!globalDoc.exists) return NextResponse.json({ error: "Course not found or no active class." }, { status: 404 });
    const global = globalDoc.data()!;

    if (!global.classActive) {
      return NextResponse.json({ error: "No class is currently active for this course.", code: "CLASS_INACTIVE" }, { status: 400 });
    }
    if (global.checkinPaused) {
      return NextResponse.json({ error: "Check-in is currently paused. Please wait.", code: "PAUSED" }, { status: 400 });
    }
    if (isClassExpired(global.startTime)) {
      return NextResponse.json({ error: "The class has ended. Check-in is no longer available.", code: "CLASS_ENDED" }, { status: 400 });
    }

    // 2. The active class's unique ID lives on the globals doc now
    const classId: string = global.currentClassId;
    if (!classId) {
      return NextResponse.json({ error: "No active class session found.", code: "CLASS_INACTIVE" }, { status: 400 });
    }

    // 3. Location check
    if (global.locationId) {
      if (typeof lat !== "number" || typeof lng !== "number") {
        return NextResponse.json({ error: "Location access is required to mark attendance.", code: "LOCATION_REQUIRED" }, { status: 400 });
      }
      const locationDoc = await db
        .collection("globals").doc("locationConfig").collection("locations").doc(global.locationId).get();
      if (locationDoc.exists) {
        const location = locationDoc.data()!;
        const distance = distanceInMeters(lat, lng, location.lat, location.lng);
        if (distance > location.radiusMeters) {
          return NextResponse.json(
            { error: `You must be at ${location.name} to mark attendance.`, code: "OUT_OF_RANGE" },
            { status: 403 }
          );
        }
      }
    }

    // 4. Student exists?
    const studentDoc = await db.collection("students").doc(normalized).get();
    if (!studentDoc.exists) return NextResponse.json({ error: "NOT_FOUND", code: "NOT_FOUND" }, { status: 404 });
    const student = studentDoc.data()!;

    // 5. Ban checks
    if (student.banned) return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
    const userDoc = await db.collection("users").doc(student.uid).get();
    if (userDoc.exists && userDoc.data()?.banned) {
      return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
    }

    // 6. Duplicate check — keyed by classId (unique per session, not date)
    const attendanceRef = db
      .collection("students").doc(normalized)
      .collection("attendance").doc(courseId)
      .collection("records").doc(classId);

    const existingMark = await attendanceRef.get();
    if (existingMark.exists) {
      return NextResponse.json({ error: "You have already marked attendance for this class.", code: "DUPLICATE" }, { status: 409 });
    }

    const now = Date.now();
    const late = isLateAttendance(global.startTime);

    // 7. Atomic write
    const batch = db.batch();

    batch.set(attendanceRef, {
      timestamp: now,
      courseId,
      classId,
      date: new Date().toISOString().split("T")[0],
      late,
      regNumber: normalized,
      markedBy: caller.admin && targetRegNumber ? callerUid : normalized,
    });

    // Increment totalPresence on the session doc
    const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(classId);
    batch.update(sessionRef, { totalPresence: FieldValue.increment(1) });

    // Increment on student record
    batch.update(db.collection("students").doc(normalized), { totalPresence: FieldValue.increment(1) });

    await batch.commit();

    return NextResponse.json({ success: true, name: student.name, late, timestamp: now });
  } catch (error) {
    console.error("Mark attendance error:", error);
    return NextResponse.json({ error: "Failed to mark attendance. Please try again." }, { status: 500 });
  }
}
