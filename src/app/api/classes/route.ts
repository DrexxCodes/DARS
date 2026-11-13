import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { cleanClassName, parseClassTiming } from "@/lib/class-timing";
import { verifyAdmin, canAccessCourse } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { streamJob, wantsStream } from "@/lib/progress-stream";
import { deleteClassDay, deleteCourseData } from "@/lib/class-delete";
import { isClassExpired } from "@/lib/utils";
import { EXTEND_LIMITS } from "@/constants/class";
import type { ScopeKey } from "@/constants/scopes";

const ACTION_SCOPE: Record<string, ScopeKey> = {
  start: "class.create",
  end: "class.end",
  pause: "class.pause",
  resume: "class.pause",
  extend: "class.extend",
};

// ─── POST: start | end | pause | resume | extend ──────────────────────────────
export async function POST(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { action, courseId, classId: targetClassId, locationId, name, durationMinutes: durationInput, lateAfterMinutes: lateInput, extendMinutes } = await req.json();

    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }
    const needed = ACTION_SCOPE[action as string];
    if (!needed) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const denied = requireScope(adminUser, needed);
    if (denied) return denied;

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
      const timing = parseClassTiming(durationInput, lateInput);
      if (!timing.ok) return NextResponse.json({ error: timing.error }, { status: 400 });
      const { durationMinutes, lateAfterMinutes } = timing;
      const className = cleanClassName(name) || null;

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

      const endTime = now + durationMinutes * 60_000;

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
        name: className,
        durationMinutes,
        lateAfterMinutes,
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
        className,
        durationMinutes,
        lateAfterMinutes,
        locationId: locationDoc.id,
        locationName: location.name,
      });

      await db.collection("activityLog").add({
        action: "start_class",
        courseId,
        classId,
        className,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true, classId, startTime: now, endTime, locationName: location.name, className });

    } else if (action === "end") {
      const globalDoc = await globalRef.get();
      const g = globalDoc.data();
      const endedClassId = typeof g?.currentClassId === "string" ? g.currentClassId : null;

      await globalRef.update({
        classActive: false,
        checkinPaused: false,
        currentClassId: null,
        startTime: null,
        endTime: null,
        className: null,
        durationMinutes: null,
        lateAfterMinutes: null,
      });

      // Remember when it really ended, so the class history shows the true time and the class can be extended later
      if (endedClassId) {
        const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(endedClassId);
        const session = await sessionRef.get();
        if (session.exists) {
          const plannedEnd = Number(session.data()!.endTime ?? 0);
          await sessionRef.update({
            endedAt: now,
            endedBy: adminUser.uid,
            ...(plannedEnd > now ? { endTime: now } : {}),
          });
        }
      }

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

    } else if (action === "extend") {
      const minutes = Number(extendMinutes);
      if (!Number.isInteger(minutes) || minutes < EXTEND_LIMITS.MIN_MIN || minutes > EXTEND_LIMITS.MAX_TOTAL_MIN) {
        return NextResponse.json({ error: "Enter how many minutes to extend by." }, { status: 400 });
      }

      const outcome = await db.runTransaction(async (tx) => {
        const globalSnap = await tx.get(globalRef);
        const g = globalSnap.data() ?? {};
        const runningNow = !!g.classActive && typeof g.currentClassId === "string" && typeof g.startTime === "number" && !isClassExpired(g.startTime, g.endTime);

        // Which class? The one named, else the one running.
        const classId: string | null = typeof targetClassId === "string" && targetClassId ? targetClassId : typeof g.currentClassId === "string" ? g.currentClassId : null;
        if (!classId || classId.includes("/")) return { error: "Pick the class to extend.", status: 400 } as const;

        const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(classId);
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists) return { error: "That class no longer exists.", status: 404 } as const;
        const s = sessionSnap.data()!;
        const startTime = Number(s.startTime ?? s.createdAt ?? 0);

        const isTheRunningClass = runningNow && g.currentClassId === classId;
        if (runningNow && !isTheRunningClass) {
          return { error: "Another class is running for this course. End it before re-opening an earlier one.", status: 409 } as const;
        }

        // Running class: add to its current end. Ended class (or one whose window already closed): count from now.
        const base = isTheRunningClass ? Number(g.endTime ?? startTime) : now;
        const newEnd = base + minutes * 60_000;
        const totalMin = Math.round((newEnd - startTime) / 60_000);
        if (totalMin > EXTEND_LIMITS.MAX_TOTAL_MIN) {
          return { error: `That would make this class run longer than ${EXTEND_LIMITS.MAX_TOTAL_MIN / 60} hours from its start. Classes can't be extended past that.`, status: 400 } as const;
        }

        tx.update(sessionRef, {
          endTime: newEnd,
          durationMinutes: totalMin,
          endedAt: FieldValue.delete(),
          extendedCount: FieldValue.increment(1),
          lastExtendedAt: now,
          lastExtendedBy: adminUser.uid,
        });

        if (isTheRunningClass) {
          tx.update(globalRef, { endTime: newEnd, durationMinutes: totalMin });
        } else {
          // Re-open: the same class (same attendance list) goes live again
          tx.set(
            globalRef,
            {
              classActive: true,
              checkinPaused: false,
              currentClassId: classId,
              startTime,
              endTime: newEnd,
              className: s.name ?? null,
              durationMinutes: totalMin,
              lateAfterMinutes: typeof s.lateAfterMinutes === "number" ? s.lateAfterMinutes : null,
              locationId: s.locationId ?? null,
              locationName: s.locationName ?? null,
            },
            { merge: true }
          );
        }
        return { ok: true, classId, endTime: newEnd, reopened: !isTheRunningClass, date: String(s.date ?? "") } as const;
      });

      if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

      await db.collection("activityLog").add({
        action: "extend_class",
        courseId,
        classId: outcome.classId,
        extendedByMinutes: minutes,
        reopened: outcome.reopened,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: now,
      });

      return NextResponse.json({ success: true, classId: outcome.classId, endTime: outcome.endTime, reopened: outcome.reopened });
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

// ─── DELETE: remove a single class session OR an entire course ────────────────
//
//  Body shapes:
//    { courseId, classId }  → delete one class day + its student attendance records   (scope: class.delete)
//    { courseId }           → delete the entire course                                (scope: course.delete)
//  Send `Accept: application/x-ndjson` to get live progress instead of a single JSON reply.
export async function DELETE(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const { courseId, classId } = await req.json();
    if (typeof courseId !== "string" || !courseId || courseId.includes("/")) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    const denied = requireScope(adminUser, classId ? "class.delete" : "course.delete");
    if (denied) return denied;
    if (!(await canAccessCourse(adminUser, courseId))) {
      return NextResponse.json({ error: "You are not assigned to this course" }, { status: 403 });
    }

    // ── Delete a single class session ──────────────────────────────────────────
    if (classId) {
      if (typeof classId !== "string" || classId.includes("/")) return NextResponse.json({ error: "Invalid class." }, { status: 400 });
      const sessionRef = db.collection("classes").doc(courseId).collection("sessions").doc(classId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      const sessionData = sessionDoc.data()!;

      const job = async (report: Parameters<typeof deleteClassDay>[2]) => {
        const result = await deleteClassDay(courseId, classId, report);
        await db.collection("activityLog").add({
          action: "delete_class",
          courseId,
          classId,
          date: sessionData.date,
          studentsAffected: result.studentsAffected,
          adminUid: adminUser.uid,
          adminName: adminUser.name,
          timestamp: Date.now(),
        });
        return { ...result, date: String(sessionData.date ?? "") };
      };

      if (wantsStream(req)) return streamJob(job);
      return NextResponse.json({ success: true, ...(await job(() => {})) });
    }

    // ── Delete the entire course ───────────────────────────────────────────────
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    const g = (await db.collection("globals").doc(courseId).get()).data();
    if (g?.classActive && typeof g.startTime === "number" && !isClassExpired(g.startTime, g.endTime)) {
      return NextResponse.json({ error: "A class is running for this course. End it before deleting the course." }, { status: 409 });
    }

    const courseName = String(courseDoc.data()?.name || courseId);
    const job = async (report: Parameters<typeof deleteCourseData>[1]) => {
      const result = await deleteCourseData(courseId, report);
      await db.collection("activityLog").add({
        action: "delete_course",
        courseId,
        courseName,
        recordsRemoved: result.recordsRemoved,
        adminUid: adminUser.uid,
        adminName: adminUser.name,
        timestamp: Date.now(),
      });
      return { ...result, courseName };
    };

    if (wantsStream(req)) return streamJob(job);
    return NextResponse.json({ success: true, ...(await job(() => {})) });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
