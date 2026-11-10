export interface Course {
  id: string;
  name: string;
  code: string;
  /** Levels this course is assigned to (100..400). Empty or missing = open to every level. */
  levels?: number[];
  /** Departments this course is restricted to (department ids). Empty or missing = open to every department. */
  departments?: string[];
  /** Admission types this course is for ("regular", "cep"). Empty or missing = both. */
  admissionTypes?: string[];
}

export interface GlobalState {
  id?: string;
  classActive: boolean;
  checkinPaused: boolean;
  startTime: number | null;
  /** When check-in closes. Missing on classes started before durations were configurable (they run 2 h). */
  endTime?: number | null;
  /** The name the admin gave this class when starting it. */
  className?: string | null;
  /** Minutes after the start when marking turns "late". */
  lateAfterMinutes?: number | null;
  currentDate?: string;
}

export interface MarkStatusPayload {
  courses: Course[];
  globals: Array<GlobalState & { id: string }>;
}

export type CarryoverStatus = "none" | "pending" | "approved" | "rejected" | "delisted";

/** A course the student can add ("Added Course") or has delisted, with where their request stands. */
export interface CarryoverEntry {
  courseId: string;
  code: string;
  name: string;
  levels: number[];
  status: CarryoverStatus;
}
