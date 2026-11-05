import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CourseAttendance } from "@/types/attendance";

/** Shown while a class is running for a course the student takes and they haven't marked it yet. */
export default function ActiveClassBanner({ pending }: { pending: CourseAttendance[] }) {
  if (pending.length === 0) return null;
  const codes = pending.map((c) => c.courseCode).join(", ");
  return (
    <Link
      href="/mark"
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {pending.length === 1 ? "A class is in progress" : `${pending.length} classes are in progress`}
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          {codes}: mark your attendance. It isn&apos;t counted as a miss while the class is on.
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
    </Link>
  );
}
