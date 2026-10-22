export interface Course {
  id: string;
  name: string;
  code: string;
  /** Levels this course is assigned to (100..400). Empty or missing = open to every level. */
  levels?: number[];
  /** Departments this course is restricted to (department ids). Empty or missing = open to every department. */
  departments?: string[];
}

export interface GlobalState {
  id?: string;
  classActive: boolean;
  checkinPaused: boolean;
  startTime: number | null;
  currentDate?: string;
}

export interface MarkStatusPayload {
  courses: Course[];
  globals: Array<GlobalState & { id: string }>;
}

export type CarryoverStatus = "none" | "pending" | "approved" | "rejected";

/** A course outside the student's level, with where their carry-over application stands. */
export interface CarryoverEntry {
  courseId: string;
  code: string;
  name: string;
  levels: number[];
  status: CarryoverStatus;
}
