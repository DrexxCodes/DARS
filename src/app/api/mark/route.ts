import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { REG_NUMBER_REGEX, isClassExpired, isLateAttendance } from "@/lib/utils";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const { allowed } = rateLimit(ip, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  try {
    const { regNumber, courseId } = await req.json();

    if (!regNumber || !courseId) {
      return NextResponse.json({ error: "Registration number and course are required." }, { status: 400 });
    }

    const normalized = regNumber.trim().toUpperCase();
    if (!REG_NUMBER_REGEX.test(normalized)) {
      return NextResponse.json({ error: "Invalid registration number format." }, { status: 400 });
    }

    // 1. Check globals for this course
    const globalDoc = await db.collection("globals").doc(courseId).get();
    if (!globalDoc.exists) {
      return NextResponse.json({ error: "Course not found or no active class." }, { status: 404 });
    }

    const global = globalDoc.data()!;

    if (!global.classActive) {
      return NextResponse.json({ error: "No class is currently active for this course.", code: "CLASS_INACTIVE" }, { status: 400 });
    }

    if (global.checkinPaused) {
      return NextResponse.json({ error: "Check-in is currently paused. Please wait.", code: "PAUSED" }, { status: 400 });
    }

    // 2. Check 2-hour window
    if (isClassExpired(global.startTime)) {
      return NextResponse.json({ error: "The class has ended. Check-in is no longer available.", code: "CLASS_ENDED" }, { status: 400 });
    }

    // 3. Check student exists
    const studentDoc = await db.collection("students").doc(normalized).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: "NOT_FOUND", code: "NOT_FOUND" }, { status: 404 });
    }

    const student = studentDoc.data()!;

    // 4. Check ban
    if (student.banned) {
      return NextResponse.json({ error: "Your attendance has been suspended. Please contact your administrator.", code: "BANNED" }, { status: 403 });
    }

    // 5. Check user record for ban too
    const userDoc = await db.collection("users").doc(student.uid).get();
    if (userDoc.exists && userDoc.data()?.banned) {
      return NextResponse.json({ error: "Your attendance has been suspended. Please contact your administrator.", code: "BANNED" }, { status: 403 });
    }

    // 6. Check duplicate attendance for this course+date
    const dateKey = global.currentDate; // set by admin when class started
    const attendanceRef = db
      .collection("students")
      .doc(normalized)
      .collection("attendance")
      .doc(courseId)
      .collection("records")
      .doc(dateKey);

    const existingMark = await attendanceRef.get();
    if (existingMark.exists) {
      return NextResponse.json({ error: "You have already marked attendance for this class.", code: "DUPLICATE" }, { status: 409 });
    }

    const now = Date.now();
    const late = isLateAttendance(global.startTime);

    // 7. Atomic: write attendance + increment totalPresence on class session
    const batch = db.batch();

    batch.set(attendanceRef, {
      timestamp: now,
      courseId,
      dateKey,
      late,
      regNumber: normalized,
    });

    // Increment attendance count on the class session
    const sessionRef = db
      .collection("classes")
      .doc(courseId)
      .collection("sessions")
      .doc(dateKey);

    batch.update(sessionRef, {
      totalPresence: FieldValue.increment(1),
    });

    // Increment on student record
    batch.update(db.collection("students").doc(normalized), {
      totalPresence: FieldValue.increment(1),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      name: student.name,
      late,
      timestamp: now,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    return NextResponse.json({ error: "Failed to mark attendance. Please try again." }, { status: 500 });
  }
}
