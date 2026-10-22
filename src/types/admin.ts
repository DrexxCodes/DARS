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

/** One class session as it appears in an attendance export. */
export interface ExportSession {
  id: string;
  /** Day the class was held (YYYY-MM-DD, UTC, as stored when the class started). */
  date: string;
  startTime: number;
  endTime: number;
  locationName: string | null;
}

export interface ExportStudent {
  regNumber: string;
  name: string;
}

/** A student's attendance record for one session. */
export interface ExportRecord {
  timestamp: number;
  late: boolean;
  /** True when an admin marked the student present (as opposed to the student marking themselves). */
  manual: boolean;
}

/** Everything the PDF builder needs for one course (optionally limited to a single day). */
export interface CourseExportData {
  course: { id: string; code: string; name: string };
  sessions: ExportSession[];
  students: ExportStudent[];
  /** records[regNumber][classId] — absent key means the student was absent. */
  records: Record<string, Record<string, ExportRecord>>;
}

/** A class session an admin could mark a student present for. */
export interface MarkableSession {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  locationName: string | null;
  /** The student already has a record for this session. */
  present: boolean;
}

/** A student's carry-over application for a course, as shown to the course's admins. */
export interface CarryoverRequest {
  regNumber: string;
  name: string;
  /** The student's own level (from their reg number). */
  level: number | null;
  status: "pending" | "approved";
  requestedAt: number;
  decidedByName: string | null;
}
