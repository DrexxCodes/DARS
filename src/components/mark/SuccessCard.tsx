"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { formatTime } from "@/lib/utils";

interface SuccessCardProps {
  name: string;
  late: boolean;
  timestamp: number;
  courseName: string;
  onMarkAnother: () => void;
}

export default function SuccessCard({ name, late, timestamp, courseName, onMarkAnother }: SuccessCardProps) {
  return (
    <div className="text-center space-y-5 animate-slide-up">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-brand-600 dark:text-brand-400" />
        </div>
      </div>

      {/* Message */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          Attendance Marked!
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Welcome, <span className="font-semibold text-slate-700 dark:text-slate-200">{name}</span>
        </p>
      </div>

      {/* Details */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm text-left">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Course</span>
          <span className="font-medium text-slate-900 dark:text-white">{courseName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Time</span>
          <span className="flex items-center gap-1 font-mono text-slate-900 dark:text-white">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {formatTime(timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Status</span>
          {late ? (
            <Badge variant="yellow">Late arrival</Badge>
          ) : (
            <Badge variant="green">On time</Badge>
          )}
        </div>
      </div>

      <Button variant="secondary" className="w-full" onClick={onMarkAnother}>
        Mark for another course
      </Button>
    </div>
  );
}
