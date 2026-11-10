import { db } from "@/lib/firebase-admin";
import { courseVisibleToStudent, type CourseAudience } from "@/lib/admission";

/**
 * Enrolment. A student normally takes the courses assigned to their level. To take a course from another level
 * (an "Added Course", e.g. a year-4 student with a year-2 course) they apply, and an admin of that course approves it.
 * A student can also drop ANY course they take, including one from their own level. That is a "delist".
 *
 * Stored at courses/{courseId}/enrollments/{REG}. For an Added Course only `approved` counts. A `delisted` doc
 * overrides everything: the student is out of that course (level or not) and their attendance for it was wiped.
 */
export type EnrollmentStatus = "pending" | "approved" | "rejected" | "delisted";

export const enrollmentRef = (courseId: string, regNumber: string) =>
  db.collection("courses").doc(courseId).collection("enrollments").doc(regNumber);

export const enrollmentsCol = (courseId: string) => db.collection("courses").doc(courseId).collection("enrollments");

/**
 * The one rule for "does this student take this course?", given whether the course is for their level and the status
 * of their enrolment doc (undefined = no doc).
 *   delisted            -> no, whatever the level
 *   course is for them  -> yes (a stale pending/rejected doc from an old Added Course request doesn't matter)
 *   otherwise           -> only with an approved Added Course
 */
export function isEnrolled(onLevel: boolean, status: string | null | undefined): boolean {
  if (status === "delisted") return false;
  return onLevel || status === "approved";
}

/** Enrolment status per course for one student, in a single batched read. Missing doc = undefined. */
export async function enrollmentStatuses(courseIds: string[], regNumber: string): Promise<Map<string, string | undefined>> {
  const snaps = courseIds.length ? await db.getAll(...courseIds.map((id) => enrollmentRef(id, regNumber))) : [];
  return new Map(courseIds.map((id, i) => [id, snaps[i].exists ? (snaps[i].data()?.status as string | undefined) : undefined]));
}

/** True when the student takes the course: it's for their level and department (or open to all) or they have an approved Added Course, and they haven't delisted it. */
export async function isEligibleForCourse(courseId: string, course: CourseAudience, regNumber: string): Promise<boolean> {
  const snap = await enrollmentRef(courseId, regNumber).get();
  return isEnrolled(courseVisibleToStudent(course, regNumber), snap.exists ? snap.data()?.status : undefined);
}

export const NOT_ENROLLED_MESSAGE =
  "This course isn't on your level list. If you need it, add it as an Added Course and wait for an admin to approve.";

export const DELISTED_MESSAGE = "You delisted this course, so you can't mark attendance for it. Ask a super admin if you need to be added back.";
export const DELISTED_MESSAGE_FOR_ADMIN = "That student has delisted this course.";

/** Reads the audience fields off a course document's data. */
export const audienceOf = (
  data: FirebaseFirestore.DocumentData | undefined
): { levels: number[]; departments: string[]; admissionTypes: string[] } => ({
  levels: Array.isArray(data?.levels) ? (data!.levels as number[]) : [],
  departments: Array.isArray(data?.departments) ? (data!.departments as string[]) : [],
  // Empty/missing = for both regular and CEP, so existing courses keep working until someone sets it.
  admissionTypes: Array.isArray(data?.admissionTypes) ? (data!.admissionTypes as string[]) : [],
});
