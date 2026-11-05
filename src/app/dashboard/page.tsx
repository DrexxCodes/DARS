"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Skeleton } from "@/components/ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { getAttendanceStatus } from "@/lib/utils";
import { BookOpen, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { useStudentAttendance } from "@/hooks/useStudentAttendance";
import StatCard from "@/components/dashboard/StatCard";
import ActiveClassBanner from "@/components/dashboard/ActiveClassBanner";
import CourseBreakdownRow from "@/components/dashboard/CourseBreakdownRow";
import DelistSheet from "@/components/course/DelistSheet";
import type { CourseAttendance } from "@/types/attendance";

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { courses: data, studentName, loading, refresh } = useStudentAttendance(profile?.regNumber, profile?.name ?? "");
  const [delisting, setDelisting] = useState<CourseAttendance | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) router.push("/auth/login");
  }, [authLoading, profile, router]);

  if (authLoading || !profile) return null;

  const totalClasses = data.reduce((s, c) => s + c.total, 0);
  const totalAttended = data.reduce((s, c) => s + c.attended, 0);
  const overallPct = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  const overallStatus = {
    accent: ({ none: "slate", critical: "red", low: "orange", normal: "blue", nerd: "green" } as const)[
      getAttendanceStatus(overallPct, totalClasses).tier
    ],
  };

  const chartData = data.map((c) => ({
    name: c.courseCode,
    fullName: c.courseName,
    attended: c.attended,
    missed: c.total - c.attended,
    percentage: c.percentage,
    pending: !!c.pendingClass,
    fill: getAttendanceStatus(c.percentage, c.total).hex,
  }));
  const pendingCourses = data.filter((c) => c.pendingClass);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          My Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Welcome back, <span className="font-medium text-slate-700 dark:text-slate-300">{studentName}</span>
          {profile.regNumber && (
            <span className="ml-2 font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {profile.regNumber}
            </span>
          )}
        </p>
      </div>

      <ActiveClassBanner pending={pendingCourses} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Overall Rate" value={`${overallPct}%`} sub="across all courses"
              icon={<TrendingUp className="w-4 h-4" />}
              accent={overallStatus.accent} />
            <StatCard label="Classes Attended" value={totalAttended} sub={`of ${totalClasses} total`}
              icon={<CheckCircle2 className="w-4 h-4" />} accent="green" />
            <StatCard label="Classes Missed" value={totalClasses - totalAttended} sub="absences recorded"
              icon={<XCircle className="w-4 h-4" />} accent="red" />
            <StatCard label="Courses" value={data.length} sub="enrolled this semester"
              icon={<BookOpen className="w-4 h-4" />} accent="blue" />
          </>
        )}
      </div>

      {/* Bar chart */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-5">
          Attendance by Course
        </h2>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No attendance data yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg text-xs space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{d.fullName}</p>
                      <p className="text-brand-600 dark:text-brand-400">Attended: {d.attended}</p>
                      <p className="text-red-500">Missed: {d.missed}</p>
                      <p className="text-slate-500">Rate: {d.percentage}%</p>
                      {d.pending && <p className="text-amber-600 dark:text-amber-400">Class in progress, not counted yet</p>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="attended" name="Attended" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
              <Bar dataKey="missed" name="Missed" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Per-course breakdown */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
          Course Breakdown
        </h2>
        {loading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No courses found.</p>
        ) : (
          <div className="space-y-3">
            {data.map((course) => (
              <CourseBreakdownRow key={course.courseId} course={course} onDelist={setDelisting} />
            ))}
          </div>
        )}
      </Card>

      <DelistSheet open={!!delisting} onClose={() => setDelisting(null)} course={delisting} onDone={refresh} />
    </div>
  );
}

