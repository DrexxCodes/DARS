import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import type { Report } from "@/lib/progress-stream";

const CHECK_CHUNK = 300; // document reads per getAll
const WRITE_CHUNK = 200; // each record costs 2 writes (delete + student counter), so 200 stays under the 500 limit

const studentRecords = (reg: string, courseId: string) => db.collection("students").doc(reg).collection("attendance").doc(courseId).collection("records");

/** Maps progress inside a phase onto a slice of the whole bar (0-100). */
const slice = (report: Report, from: number, to: number) => (step: string, done: number, total: number) =>
  report({ step, done: Math.round(from + (total ? (done / total) * (to - from) : to - from)), total: 100 });

/** Closes check-in if `classId` (or any class of the course, when omitted) is the one running, so nobody can mark mid-delete. */
async function stopLiveClass(courseId: string, classId?: string) {
  const ref = db.collection("globals").doc(courseId);
  const snap = await ref.get();
  const g = snap.data();
  if (!g?.classActive) return;
  if (classId && g.currentClassId !== classId) return;
  await ref.update({ classActive: false, checkinPaused: false, currentClassId: null, startTime: null, endTime: null, className: null, durationMinutes: null, lateAfterMinutes: null });
}

/**
 * Deletes one class day: every student's record for it (their `totalPresence` goes down with it), the session itself and
 * the course's class counter. Reports progress as it goes. Safe to run again after an interruption.
 */
export async function deleteClassDay(courseId: string, classId: string, report: Report): Promise<{ studentsAffected: number }> {
  report({ step: "Closing check-in for this class…", done: 0, total: 100 });
  await stopLiveClass(courseId, classId);

  report({ step: "Finding students…", done: 2, total: 100 });
  const studentIds = (await db.collection("students").select().get()).docs.map((d) => d.id);

  // Phase 1: which students have a record for this class (batched reads, many at a time)
  const found: string[] = [];
  const checking = slice(report, 5, 65);
  for (let i = 0; i < studentIds.length; i += CHECK_CHUNK) {
    const chunk = studentIds.slice(i, i + CHECK_CHUNK);
    const snaps = await db.getAll(...chunk.map((reg) => studentRecords(reg, courseId).doc(classId)));
    snaps.forEach((s, j) => s.exists && found.push(chunk[j]));
    checking(`Checking attendance records (${Math.min(i + CHECK_CHUNK, studentIds.length)} of ${studentIds.length} students)`, Math.min(i + CHECK_CHUNK, studentIds.length), studentIds.length);
  }

  // Phase 2: remove them and lower each student's counter
  const removing = slice(report, 65, 92);
  removing(found.length ? `Removing ${found.length} attendance record${found.length === 1 ? "" : "s"}…` : "No attendance to remove", 0, found.length);
  for (let i = 0; i < found.length; i += WRITE_CHUNK) {
    const batch = db.batch();
    for (const reg of found.slice(i, i + WRITE_CHUNK)) {
      batch.delete(studentRecords(reg, courseId).doc(classId));
      batch.update(db.collection("students").doc(reg), { totalPresence: FieldValue.increment(-1) });
    }
    await batch.commit();
    removing(`Removing attendance records (${Math.min(i + WRITE_CHUNK, found.length)} of ${found.length})`, Math.min(i + WRITE_CHUNK, found.length), found.length);
  }

  // Phase 3: the session (and anything under it, e.g. per-admin mark counters) and the course's class counter
  report({ step: "Deleting the class day…", done: 94, total: 100 });
  await db.recursiveDelete(db.collection("classes").doc(courseId).collection("sessions").doc(classId));
  await db.collection("courses").doc(courseId).update({ totalClasses: FieldValue.increment(-1) });
  report({ step: "Finishing up…", done: 99, total: 100 });

  return { studentsAffected: found.length };
}


/**
 * Deletes a whole course: every student's attendance for it, its classes, enrolments, live state and log entries, and the
 * course itself. Reports progress as it goes.
 */
export async function deleteCourseData(courseId: string, report: Report): Promise<{ recordsRemoved: number }> {
  report({ step: "Closing any running class…", done: 0, total: 100 });
  await stopLiveClass(courseId);

  report({ step: "Finding students…", done: 2, total: 100 });
  const studentIds = (await db.collection("students").select().get()).docs.map((d) => d.id);

  // Phase 1: collect each student's records for the course (a few students at a time), then clear them
  let recordsRemoved = 0;
  const clearing = slice(report, 4, 80);
  const PARALLEL = 25;
  type Found = { reg: string; refs: FirebaseFirestore.DocumentReference[] };
  let pending: Found[] = [];

  const flush = async () => {
    // Each batch: record deletes + one counter update per student + the (empty) attendance parent doc
    let batch = db.batch();
    let ops = 0;
    const commit = async () => {
      if (ops) await batch.commit();
      batch = db.batch();
      ops = 0;
    };
    for (const f of pending) {
      if (ops + f.refs.length + 2 > 450) await commit();
      f.refs.forEach((r) => batch.delete(r));
      batch.update(db.collection("students").doc(f.reg), { totalPresence: FieldValue.increment(-f.refs.length) });
      batch.delete(db.collection("students").doc(f.reg).collection("attendance").doc(courseId));
      ops += f.refs.length + 2;
      recordsRemoved += f.refs.length;
    }
    await commit();
    pending = [];
  };

  for (let i = 0; i < studentIds.length; i += PARALLEL) {
    const chunk = studentIds.slice(i, i + PARALLEL);
    const results = await Promise.all(chunk.map(async (reg) => ({ reg, refs: (await studentRecords(reg, courseId).select().get()).docs.map((d) => d.ref) })));
    pending.push(...results.filter((r) => r.refs.length));
    if (pending.length >= 100) await flush();
    clearing(`Clearing attendance (${Math.min(i + PARALLEL, studentIds.length)} of ${studentIds.length} students)`, Math.min(i + PARALLEL, studentIds.length), studentIds.length);
  }
  await flush();

  // Phase 2: classes, enrolments, live state, log, admin assignments, the course
  report({ step: "Deleting classes and enrolments…", done: 84, total: 100 });
  await db.recursiveDelete(db.collection("classes").doc(courseId));
  await db.recursiveDelete(db.collection("courses").doc(courseId).collection("enrollments"));
  await db.collection("globals").doc(courseId).delete().catch(() => {});

  report({ step: "Removing activity log entries…", done: 90, total: 100 });
  const logSnap = await db.collection("activityLog").where("courseId", "==", courseId).get();
  for (let i = 0; i < logSnap.docs.length; i += 450) {
    const batch = db.batch();
    logSnap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  report({ step: "Updating admin assignments…", done: 95, total: 100 });
  const assigned = await db.collection("users").where("assignedCourses", "array-contains", courseId).get();
  if (!assigned.empty) {
    const batch = db.batch();
    assigned.docs.forEach((d) => batch.update(d.ref, { assignedCourses: FieldValue.arrayRemove(courseId) }));
    await batch.commit();
  }

  report({ step: "Deleting the course…", done: 98, total: 100 });
  await db.collection("courses").doc(courseId).delete();
  return { recordsRemoved };
}
