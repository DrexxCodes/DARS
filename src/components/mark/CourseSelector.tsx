"use client";

import { cn } from "@/lib/utils";
import { BookOpen, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { Skeleton } from "@/components/ui";

interface Course {
  id: string;
  name: string;
  code: string;
  classActive?: boolean;
  checkinPaused?: boolean;
  startTime?: number;
}

interface CourseSelectorProps {
  courses: Course[];
  globals: Record<string, { classActive: boolean; checkinPaused: boolean; startTime: number }>;
  selected: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export default function CourseSelector({ courses, globals, selected, onSelect, loading }: CourseSelectorProps) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!courses.length) {
    return (
      <div className="text-center py-10 text-slate-400 dark:text-slate-500">
        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No active courses available.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {courses.map((course) => {
        const g = globals[course.id];
        const isActive = g?.classActive;
        const isPaused = g?.checkinPaused;
        const isSelected = selected === course.id;

        return (
          <button
            key={course.id}
            onClick={() => onSelect(course.id)}
            className={cn(
              "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-200",
              isSelected
                ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-700",
              !isActive && "opacity-60"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  isActive && !isPaused ? "bg-brand-100 dark:bg-brand-900" : "bg-slate-100 dark:bg-slate-800"
                )}>
                  <BookOpen className={cn(
                    "w-4 h-4",
                    isActive && !isPaused ? "text-brand-600 dark:text-brand-400" : "text-slate-400"
                  )} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{course.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{course.code}</p>
                </div>
              </div>
              <div className="shrink-0">
                {isActive && !isPaused ? (
                  <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </span>
                ) : isPaused ? (
                  <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    <PauseCircle className="w-3.5 h-3.5" />
                    Paused
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
