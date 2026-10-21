/** One attendance record that a revoke would remove (shown in the preview step). */
export interface RevokeRecord {
  courseId: string;
  courseName: string;
  courseCode: string;
  classId: string;
  timestamp: number;
  late: boolean;
}

/** What a full reset would delete. Values are null if the count couldn't be fetched. */
export interface ResetCounts {
  students: number | null;
  courses: number | null;
  sessions: number | null;
  records: number | null;
}
