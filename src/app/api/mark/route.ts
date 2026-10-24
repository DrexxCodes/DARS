import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/rate-limit";
import { REG_NUMBER_REGEX, isClassExpired, isLateAttendance } from "@/lib/utils";
import { distanceInMeters } from "@/lib/geo";
import { courseVisibleToStudent } from "@/lib/admission";
import { audienceOf, enrollmentRef, NOT_ENROLLED_MESSAGE } from "@/lib/enrollment";
import { ttlCache } from "@/lib/ttl-cache";
import { LOCATION_LIMITS } from "@/constants/location";
import { DEVICE_CONFLICT, SIGNALS_REQUIRED, buildDeviceClaims, getClientIp, parseDeviceSignals } from "@/lib/device-check";

interface LocationTag { name: string; lat: number; lng: number; radiusMeters: number }

// Location tags almost never change mid-class, so every student in the hall shares one read per minute per instance.
const locationCache = ttlCache<LocationTag | null>(60_000);
const loadLocation = (locationId: string) =>
  locationCache.get(locationId, async () => {
    const snap = await db.collection("globals").doc("locationConfig").collection("locations").doc(locationId).get();
    return snap.exists ? (snap.data() as LocationTag) : null;
  });

// Which levels, departments and admission types a course is assigned to. Edited rarely, so a short cache keeps this off the hot path.
const courseAudienceCache = ttlCache<ReturnType<typeof audienceOf>>(30_000);
const loadCourseAudience = (courseId: string) =>
  courseAudienceCache.get(courseId, async () => {
    const snap = await db.collection("courses").doc(courseId).get();
    return audienceOf(snap.data());
  });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // A whole lecture hall can sit behind ONE campus Wi-Fi / mobile-carrier IP, so the per-IP cap is generous
  // and only exists to blunt floods. The per-account cap below is the real brake.
  if (!rateLimit(`ip:${ip}`, 600, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" }, { status: 429 });
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

  if (!rateLimit(`uid:${callerUid}`, 15, 60_000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment.", code: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const { courseId, lat, lng, accuracy, regNumber: targetRegNumber, fingerprint, deviceId } = await req.json();
    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "Course is required." }, { status: 400 });
    }

    // Round 1 (parallel): who is calling + the course's live class state + which levels/departments the course is for
    const [callerDoc, globalDoc, courseAudience] = await Promise.all([
      db.collection("users").doc(callerUid).get(),
      db.collection("globals").doc(courseId).get(),
      loadCourseAudience(courseId),
    ]);

    if (!callerDoc.exists) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    const caller = callerDoc.data()!;

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

    // A student can only mark courses assigned to their level and department, or a carry-over an admin has approved.
    // Applies to an admin marking for another student too, so the course's records only ever hold its own students.
    if (!courseVisibleToStudent(courseAudience, normalized)) {
      const enrol = await enrollmentRef(courseId, normalized).get(); // only reached for off-level students
      if (!(enrol.exists && enrol.data()?.status === "approved")) {
        return NextResponse.json(
          { error: targetRegNumber ? "That student isn't in this course's level and has no approved carry-over." : NOT_ENROLLED_MESSAGE, code: "WRONG_LEVEL" },
          { status: 403 }
        );
      }
    }

    // Device signals are required for self-marks. Admin overrides skip them (the admin's phone would collide with itself).
    const signals = targetRegNumber ? null : parseDeviceSignals(fingerprint, deviceId);
    if (!targetRegNumber && !signals) {
      return NextResponse.json(SIGNALS_REQUIRED, { status: 400 });
    }

    if (!globalDoc.exists) return NextResponse.json({ error: "Course not found or no active class.", code: "CLASS_INACTIVE" }, { status: 404 });
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

    // The active class's unique ID lives on the globals doc
    const classId: string = global.currentClassId;
    if (!classId) {
      return NextResponse.json({ error: "No active class session found.", code: "CLASS_INACTIVE" }, { status: 400 });
    }

    // Location check — FAILS CLOSED: a class with no usable location can't be marked.
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
    const lowAccuracyResponse = () =>
      NextResponse.json(
        { error: "Your location signal is too weak/imprecise. Turn on GPS (high accuracy), step outside or near a window, and try again.", code: "LOW_ACCURACY" },
        { status: 400 }
      );
    if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > LOCATION_LIMITS.HARD_MAX_ACCURACY_M) {
      return lowAccuracyResponse();
    }

    // Round 2 (parallel): student, duplicate mark, device claims and the location tag (cached)
    const studentRef = db.collection("students").doc(normalized);
    const attendanceRef = studentRef.collection("attendance").doc(courseId).collection("records").doc(classId);
    const claims = signals
      ? buildDeviceClaims({ courseId, classId, startTime: global.startTime, regNumber: normalized, ip, signals })
      : null;

    const [studentDoc, existingMark, claimSnaps, location] = await Promise.all([
      studentRef.get(),
      attendanceRef.get(),
      claims ? db.getAll(...claims.refs) : Promise.resolve([]),
      loadLocation(global.locationId),
    ]);

    if (!location) {
      return NextResponse.json(
        { error: "This class's location tag no longer exists. Ask your lecturer to restart the class.", code: "LOCATION_NOT_CONFIGURED" },
        { status: 400 }
      );
    }

    const distance = distanceInMeters(lat, lng, location.lat, location.lng);
    // A fix worse than MAX_ACCURACY_M is still fine when the whole uncertainty circle lies inside the class radius
    // (the student is provably in range). Otherwise it's too imprecise to trust.
    const preciseEnough = accuracy <= LOCATION_LIMITS.MAX_ACCURACY_M;
    const provablyInside = distance + accuracy <= location.radiusMeters;
    if (!preciseEnough && !provablyInside) return lowAccuracyResponse();
    if (distance > location.radiusMeters) {
      return NextResponse.json(
        { error: `You must be at ${location.name} to mark attendance.`, code: "OUT_OF_RANGE" },
        { status: 403 }
      );
    }

    // Student exists?
    if (!studentDoc.exists) return NextResponse.json({ error: "NOT_FOUND", code: "NOT_FOUND" }, { status: 404 });
    const student = studentDoc.data()!;

    // Ban checks (the linked account's doc is already in hand for self-marks)
    if (student.banned) return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
    if (student.uid) {
      const accountDoc = student.uid === callerUid ? callerDoc : await db.collection("users").doc(student.uid).get();
      if (accountDoc.exists && accountDoc.data()?.banned) {
        return NextResponse.json({ error: "Your attendance has been suspended.", code: "BANNED" }, { status: 403 });
      }
    }

    // Duplicate check — keyed by classId (unique per session, not date). Includes the original result so a client
    // whose first response was lost can still show success.
    if (existingMark.exists) {
      const m = existingMark.data()!;
      return NextResponse.json(
        { error: "You have already marked attendance for this class.", code: "DUPLICATE", name: student.name, late: !!m.late, timestamp: m.timestamp },
        { status: 409 }
      );
    }

    // Device check — same browser profile, or same phone model on the same network, already marked this class
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

    // Atomic write
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
    batch.update(studentRef, { totalPresence: FieldValue.increment(1) });

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
        if (raced.exists) {
          const m = raced.data()!;
          return NextResponse.json(
            { error: "You have already marked attendance for this class.", code: "DUPLICATE", name: student.name, late: !!m.late, timestamp: m.timestamp },
            { status: 409 }
          );
        }
        return NextResponse.json(DEVICE_CONFLICT, { status: 403 });
      }
      throw e;
    }

    return NextResponse.json({ success: true, name: student.name, late, timestamp: now });
  } catch (error) {
    console.error("Mark attendance error:", error);
    return NextResponse.json({ error: "Failed to mark attendance. Please try again." }, { status: 500 });
  }
}
