import { db } from "@/lib/firebase-admin";
import { courseVisibleToStudent, type CourseAudience } from "@/lib/admission";

/**
 * Carry-over enrolment. A student normally takes the courses assigned to their level. For a carry-over (e.g. a
 * year-4 student with a year-2 course) they apply, and an admin of that course approves it.
 *
 * Stored at courses/{courseId}/enrollments/{REG}. Only `approved` counts.
 */
export type EnrollmentStatus = "pending" | "approved" | "rejected";

export const enrollmentRef = (courseId: string, regNumber: string) =>
  db.collection("courses").doc(courseId).collection("enrollments").doc(regNumber);

export const enrollmentsCol = (courseId: string) => db.collection("courses").doc(courseId).collection("enrollments");

/** True when the course is for the student's level and department (or open to all), or they have an approved carry-over. */
export async function isEligibleForCourse(courseId: string, course: CourseAudience, regNumber: string): Promise<boolean> {
  if (courseVisibleToStudent(course, regNumber)) return true;
  const snap = await enrollmentRef(courseId, regNumber).get();
  return snap.exists && snap.data()?.status === "approved";
}

export const NOT_ENROLLED_MESSAGE =
  "This course isn't for your level. If it's a carry-over, apply for it and wait for an admin to approve.";

/** Reads the audience fields off a course document's data. */
export const audienceOf = (
  data: FirebaseFirestore.DocumentData | undefined
): { levels: number[]; departments: string[]; admissionTypes: string[] } => ({
  levels: Array.isArray(data?.levels) ? (data!.levels as number[]) : [],
  departments: Array.isArray(data?.departments) ? (data!.departments as string[]) : [],
  // Empty/missing = for both regular and CEP, so existing courses keep working until someone sets it.
  admissionTypes: Array.isArray(data?.admissionTypes) ? (data!.admissionTypes as string[]) : [],
});
