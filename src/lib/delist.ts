import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { enrollmentRef } from "@/lib/enrollment";

export interface DelistActor {
  /** "self" when the student delisted themselves, otherwise the admin's uid. */
  by: string;
  byName: string;
}

export type DelistResult =
  | { ok: true; recordsCleared: number }
  | { ok: false; reason: "STUDENT_NOT_FOUND" | "COURSE_NOT_FOUND" };

const CHUNK = 100; // records per transaction: 100 record reads + 100 session reads + writes stays well under Firestore's 500 limit

/**
 * Delists a student from a course and permanently wipes their attendance for it.
 *
 *  1. The enrolment doc flips to `delisted` first, so from that moment the student can no longer mark the course.
 *  2. Their records for the course are then deleted in transactional chunks. Each record's session `totalPresence` and
 *     the student's own `totalPresence` go down with it, so counters stay exact, and a retry or double-tap can't
 *     decrement twice (a chunk only touches records that still exist).
 *
 * Safe to call again on an already-delisted student: it just finishes any wipe that was interrupted.
 */
export async function delistStudent(regNumber: string, courseId: string, actor: DelistActor): Promise<DelistResult> {
  const studentRef = db.collection("students").doc(regNumber);
  const [studentDoc, courseDoc] = await Promise.all([studentRef.get(), db.collection("courses").doc(courseId).get()]);
  if (!studentDoc.exists) return { ok: false, reason: "STUDENT_NOT_FOUND" };
  if (!courseDoc.exists) return { ok: false, reason: "COURSE_NOT_FOUND" };
  const student = studentDoc.data()!;

  await enrollmentRef(courseId, regNumber).set(
    {
      regNumber,
      name: String(student.name ?? ""),
      uid: student.uid ?? null,
      status: "delisted",
      delistedAt: Date.now(),
      delistedBy: actor.by,
      delistedByName: actor.byName,
    },
    { merge: true }
  );

  const recordsCol = studentRef.collection("attendance").doc(courseId).collection("records");
  const recordRefs = (await recordsCol.select().get()).docs.map((d) => d.ref); // ids only, no field data

  let cleared = 0;
  for (let i = 0; i < recordRefs.length; i += CHUNK) {
    const chunk = recordRefs.slice(i, i + CHUNK);
    cleared += await db.runTransaction(async (tx) => {
      const recordSnaps = await tx.getAll(...chunk);
      const existing = recordSnaps.filter((s) => s.exists);
      if (existing.length === 0) return 0;

      const sessionRefs = existing.map((s) => db.collection("classes").doc(courseId).collection("sessions").doc(s.id));
      const sessionSnaps = await tx.getAll(...sessionRefs);

      existing.forEach((s, j) => {
        tx.delete(s.ref);
        if (sessionSnaps[j].exists) tx.update(sessionRefs[j], { totalPresence: FieldValue.increment(-1) });
      });
      tx.update(studentRef, { totalPresence: FieldValue.increment(-existing.length) });
      return existing.length;
    });
  }

  // The empty parent doc under attendance/{courseId} goes too (nothing else lives on it)
  await studentRef.collection("attendance").doc(courseId).delete().catch(() => {});

  await db.collection("activityLog").add({
    action: actor.by === "self" ? "delist_course_self" : "delist_course_admin",
    courseId,
    regNumber,
    studentName: student.name ?? null,
    recordsCleared: cleared,
    adminUid: actor.by === "self" ? null : actor.by,
    adminName: actor.byName,
    timestamp: Date.now(),
  });

  return { ok: true, recordsCleared: cleared };
}
