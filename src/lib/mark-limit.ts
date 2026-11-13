import { db } from "@/lib/firebase-admin";

/**
 * Per-class counter of how many students a scoped admin has marked for.
 * classes/{courseId}/sessions/{classId}/adminMarks/{adminUid} = { count }. It lives under the session, so deleting the
 * class day (recursiveDelete) removes it too.
 */
export const adminMarksRef = (courseId: string, classId: string, adminUid: string) =>
  db.collection("classes").doc(courseId).collection("sessions").doc(classId).collection("adminMarks").doc(adminUid);
