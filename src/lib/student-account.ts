import { db, auth } from "@/lib/firebase-admin";
import { clearStudentCourseRecords } from "@/lib/delist";
import { enrollmentRef } from "@/lib/enrollment";
import { bindingRef } from "@/lib/device-binding";
import type { Report } from "@/lib/progress-stream";

export interface StudentTarget {
  regNumber: string;
  /** Firebase Auth uid of the student's login, if they have one. */
  uid: string | null;
  name: string;
}

const slice = (report: Report, from: number, to: number) => (step: string, done: number, total: number) =>
  report({ step, done: Math.round(from + (total ? (done / total) * (to - from) : to - from)), total: 100 });

/**
 * Permanently deletes a student: their attendance records (session and student counters kept exact), course enrolments,
 * device link, login account, user profile and the student record itself. Reports progress as it goes.
 *
 * Ordered so that an interruption is safe to retry: the student record goes LAST, so the lookup still finds them and the
 * remaining steps simply run again (each step only touches what is still there).
 */
export async function deleteStudentAccount(target: StudentTarget, report: Report): Promise<{ recordsCleared: number; coursesCleared: number }> {
  const { regNumber, uid } = target;
  const studentRef = db.collection("students").doc(regNumber);

  report({ step: "Looking up their records…", done: 1, total: 100 });
  const courseRefs = await studentRef.collection("attendance").listDocuments(); // includes parents with no fields of their own
  const studentDoc = await studentRef.get();

  // 1. Attendance, course by course
  let recordsCleared = 0;
  const clearing = slice(report, 3, 70);
  for (let i = 0; i < courseRefs.length; i++) {
    clearing(`Clearing attendance (course ${i + 1} of ${courseRefs.length})`, i, courseRefs.length);
    recordsCleared += await clearStudentCourseRecords(regNumber, courseRefs[i].id);
    await courseRefs[i].delete().catch(() => {});
  }
  clearing(courseRefs.length ? "Attendance cleared" : "No attendance to clear", courseRefs.length, courseRefs.length);

  // 2. Enrolments (Added Course requests, approvals and delisted markers) in every course
  report({ step: "Removing course enrolments…", done: 72, total: 100 });
  const courseIds = (await db.collection("courses").select().get()).docs.map((d) => d.id);
  if (courseIds.length) {
    const snaps = await db.getAll(...courseIds.map((id) => enrollmentRef(id, regNumber)));
    const existing = snaps.filter((s) => s.exists);
    for (let i = 0; i < existing.length; i += 450) {
      const batch = db.batch();
      existing.slice(i, i + 450).forEach((s) => batch.delete(s.ref));
      await batch.commit();
    }
  }

  // 3. The device link (only the browser's link doc, and only while it still points at this student)
  report({ step: "Unlinking their device…", done: 80, total: 100 });
  const did: unknown = studentDoc.data()?.boundDevice?.did;
  if (typeof did === "string") {
    const link = await bindingRef(did).get();
    if (link.exists && link.data()?.regNumber === regNumber) await link.ref.delete();
  }

  // 4. Login account and profile
  if (uid) {
    report({ step: "Deleting their login account…", done: 86, total: 100 });
    await auth.deleteUser(uid).catch((e: { code?: string }) => {
      if (e?.code !== "auth/user-not-found") throw e;
    });
    report({ step: "Deleting their profile…", done: 92, total: 100 });
    const profileRef = db.collection("users").doc(uid);
    const profile = await profileRef.get();
    // Only if it really is this student's profile
    if (profile.exists && profile.data()?.regNumber === regNumber) await profileRef.delete();
  }

  // 5. The student record, last
  report({ step: "Deleting the student record…", done: 97, total: 100 });
  await studentRef.delete();

  return { recordsCleared, coursesCleared: courseRefs.length };
}
