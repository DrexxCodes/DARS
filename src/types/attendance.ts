/** One course in a student's attendance overview (from GET /api/admin/students/[regNumber]). */
export interface CourseAttendance {
  courseId: string;
  courseName: string;
  courseCode: string;
  attended: number;
  /** Classes held, not counting a class that's running right now that the student hasn't marked yet. */
  total: number;
  percentage: number;
  /** A scoped admin can't see this course. */
  locked?: boolean;
  /** The student takes this course (their level/department, or an approved Added Course, and not delisted). */
  offered?: boolean;
  /** The student (or a super admin) delisted them from this course. */
  delisted?: boolean;
  /** A class is running right now and the student hasn't marked it yet. */
  pendingClass?: boolean;
}
