import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { REG_NUMBER_REGEX, isClassExpired, isLateAttendance } from "@/lib/utils";
import { distanceInMeters } from "@/lib/geo";
import { DEVICE_CONFLICT, SIGNALS_REQUIRED, buildDeviceClaims, getClientIp, parseDeviceSignals } from "@/lib/device-check";

// Reject fixes less precise than this (IP/cell-tower based fixes are often 1km+ off).
const MAX_ACCURACY_METERS = 150;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
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

    const { courseId, lat, lng, accuracy, regNumber: targetRegNumber, fingerprint, deviceId } = await req.json();
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

    // Device signals are required for self-marks. Admin overrides skip them (the admin's phone would collide with itself).
    const signals = targetRegNumber ? null : parseDeviceSignals(fingerprint, deviceId);
    if (!targetRegNumber && !signals) {
      return NextResponse.json(SIGNALS_REQUIRED, { status: 400 });
    }

    // 1. Fetch globals + student together (independent reads)
    const [globalDoc, studentDoc] = await Promise.all([
      db.collection("globals").doc(courseId).get(),
      db.collection("students").doc(normalized).get(),
    ]);
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

    // 3. Location check — FAILS CLOSED: a class with no usable location can't be marked.
    if (!global.locationId) {
      return NextResponse.json(
        { error: "This class has no location set. Ask your lecturer to restart it.", code: "LOCATION_NOT_CONFIGURED" },
        { status: 400 }
      );
    }
    const validCoords =
      typeof lat === "number" && typeof lng === "number" &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!validCoords) {
      return NextResponse.json({ error: "Location access is required to mark attendance.", code: "LOCATION_REQUIRED" }, { status: 400 });
    }
    if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_METERS) {
      return NextResponse.json(
        { error: "Your location signal is too weak/imprecise. Turn on GPS (high accuracy), step outside or near a window, and try again.", code: "LOW_ACCURACY" },
        { status: 400 }
      );
    }
    // Remaining reads run in parallel: location, user (ban), duplicate mark and device claims.
    const student = studentDoc.exists ? studentDoc.data()! : null;
    const attendanceRef = db
      .collection("students").doc(normalized)
      .collection("attendance").doc(courseId)
      .collection("records").doc(classId);
    const claims = signals
      ? buildDeviceClaims({ courseId, classId, startTime: global.startTime, regNumber: normalized, ip, signals })
      : null;

    const [locationDoc, userDoc, existingMark, claimSnaps] = await Promise.all([
      db.collection("globals").doc("locationConfig").collection("locations").doc(global.locationId).get(),
      student?.uid ? db.collection("users").doc(student.uid).get() : Promise.resolve(null),
      attendanceRef.get(),
      claims ? db.getAll(...claims.refs) : Promise.resolve([]),
    ]);

    if (!locationDoc.exists) {
      return NextResponse.json(
        { error: "This class's location tag no longer exists. Ask your lecturer to restart the class.", code: "LOCATION_NOT_CONFIGURED" },
        { status: 400 }
      );
    }
    const location = locationDoc.data()!;
    const distance = distanceInMeters(lat, lng, location.lat, location.lng);
    if (distance > location.radiusMeters) {
      return NextResponse.json(
        { error: `You must be at ${location.name} to mark attendance.`, code: "OUT_OF_RANGE" },
        { status: 403 }
      );
    }

    // 4. Student exists?
    if (!student) return NextResponse.json({ error: "NOT_FOUND", code: "NOT_FOUND" }, { status: 404 });

    // 5. Ban checks
    if (student.banned) return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
    if (userDoc?.exists && userDoc.data()?.banned) {
      return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
    }

    // 6. Duplicate check — keyed by classId (unique per session, not date)
    if (existingMark.exists) {
      return NextResponse.json({ error: "You have already marked attendance for this class.", code: "DUPLICATE" }, { status: 409 });
    }

    // 6b. Device check — same browser profile, or same phone model on the same network, already marked this class
    const conflicts = claimSnaps.filter((snap) => snap.exists);
    if (conflicts.length > 0) {
      console.warn("[device-conflict]", {
        classId,
        courseId,
        attempted: normalized,
        alreadyMarkedBy: conflicts.map((snap) => snap.data()?.regNumber),
      });
      return NextResponse.json(DEVICE_CONFLICT, { status: 403 });
    }

    const now = Date.now();
    const late = isLateAttendance(global.startTime);

    // 7. Atomic write
    const batch = db.batch();

    // create() (not set()) so two simultaneous requests can't both succeed and double-count
    batch.create(attendanceRef, {
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

    // Device claims (create() fails if a racing request already took either one)
    if (claims) {
      for (const ref of claims.refs) batch.create(ref, claims.data);
    }

    try {
      await batch.commit();
    } catch (e) {
      if ((e as { code?: number }).code === 6) {
        // ALREADY_EXISTS: either the attendance record or a device claim lost a race
        const raced = await attendanceRef.get();
        return raced.exists
          ? NextResponse.json({ error: "You have already marked attendance for this class.", code: "DUPLICATE" }, { status: 409 })
          : NextResponse.json(DEVICE_CONFLICT, { status: 403 });
      }
      throw e;
    }

    return NextResponse.json({ success: true, name: student.name, late, timestamp: now });
  } catch (error) {
    console.error("Mark attendance error:", error);
    return NextResponse.json({ error: "Failed to mark attendance. Please try again." }, { status: 500 });
  }
}
