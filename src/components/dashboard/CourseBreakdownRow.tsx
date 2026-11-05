import { Badge } from "@/components/ui";
import { getAttendanceStatus } from "@/lib/utils";
import { UserMinus } from "lucide-react";
import type { CourseAttendance } from "@/types/attendance";

interface Props {
  course: CourseAttendance;
  onDelist: (course: CourseAttendance) => void;
}

/** One course in the student's breakdown: attendance rate, "class in progress" when a class awaits their mark, and Delist. */
export default function CourseBreakdownRow({ course, onDelist }: Props) {
  const status = getAttendanceStatus(course.percentage, course.total);
  return (
    <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{course.courseName}</p>
          <p className="font-mono text-xs text-slate-400">{course.courseCode}</p>
        </div>
        <div className="shrink-0">
          {course.pendingClass ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Class in progress
            </span>
          ) : (
            <Badge variant={status.badge}>{status.label}</Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full rounded-full transition-all duration-700 ${status.bar}`} style={{ width: `${Math.min(course.percentage, 100)}%` }} />
        </div>
        <p className={`text-sm font-bold ${status.text}`}>{course.percentage}%</p>
        <p className="w-10 text-right text-xs text-slate-400">{course.attended}/{course.total}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-amber-700 dark:text-amber-400">
          {course.pendingClass ? "Attendance pending: mark it before the class ends." : ""}
        </p>
        <button
          onClick={() => onDelist(course)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <UserMinus className="h-3.5 w-3.5" />
          Delist
        </button>
      </div>
    </div>
  );
}
