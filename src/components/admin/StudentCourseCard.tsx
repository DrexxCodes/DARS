import { BookOpen, TrendingUp, UserMinus } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { getAttendanceStatus } from "@/lib/utils";
import type { CourseAttendance } from "@/types/attendance";

interface Props {
  course: CourseAttendance;
  /** Super admins can delist the student from the course. */
  onDelist?: (course: CourseAttendance) => void;
}

/** One course the student takes, on Student Lookup. */
export default function StudentCourseCard({ course: c, onDelist }: Props) {
  const status = getAttendanceStatus(c.percentage, c.total);
  return (
    <Card className={`space-y-3 p-4 ${status.card}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{c.courseCode}</span>
        </div>
        {c.pendingClass ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Class in progress
          </span>
        ) : (
          <Badge variant={status.badge}>{c.total === 0 ? status.label : `${c.percentage}% · ${status.label}`}</Badge>
        )}
      </div>
      <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{c.courseName}</p>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {c.attended} / {c.total} classes
        </span>
        {c.total > 0 && (
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={`h-full rounded-full transition-all ${status.bar}`} style={{ width: `${Math.min(c.percentage, 100)}%` }} />
          </div>
        )}
      </div>
      {c.pendingClass && <p className="text-xs text-amber-700 dark:text-amber-400">A class is running and they haven&apos;t marked yet. It isn&apos;t counted as a miss.</p>}
      {onDelist && (
        <div className="flex justify-end">
          <button
            onClick={() => onDelist(c)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <UserMinus className="h-3.5 w-3.5" />
            Delist student
          </button>
        </div>
      )}
    </Card>
  );
}
