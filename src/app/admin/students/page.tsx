"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import { Search, Lock, BookOpen, TrendingUp, User } from "lucide-react";

interface CourseAttendance {
  courseId: string;
  courseName: string;
  courseCode: string;
  attended: number;
  total: number;
  percentage: number;
  locked: boolean;
}
interface StudentResult {
  regNumber: string;
  name: string;
  department?: string;
}

export default function StudentSearchPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentResult | null>(null);
  const [courses, setCourses] = useState<CourseAttendance[]>([]);

  useEffect(() => {
    if (!authLoading && (!profile || !profile.admin)) router.push("/");
  }, [authLoading, profile, router]);

  const getToken = async () => clientAuth.currentUser?.getIdToken();

  const handleSearch = async () => {
    const reg = query.trim().toUpperCase();
    if (!reg) return;
    setSearching(true);
    setStudent(null);
    setCourses([]);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/students/${reg}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Student not found.");
        return;
      }
      setStudent({ regNumber: reg, ...data.student });
      setCourses(data.courses || []);
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  if (authLoading || !profile?.admin) return null;

  const assignedCourses = courses.filter((c) => !c.locked);
  const lockedCourses = courses.filter((c) => c.locked);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Lookup</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Search by registration number to view attendance across courses
        </p>
      </div>

      <Card className="p-5">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 2023133001"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            icon={<Search className="w-4 h-4" />}
            className="flex-1"
          />
          <Button loading={searching} onClick={handleSearch}>Search</Button>
        </div>
      </Card>

      {student && (
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-brand-700 dark:text-brand-300" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{student.name}</p>
            <p className="text-sm text-slate-500 font-mono">{student.regNumber}</p>
            {student.department && <p className="text-xs text-slate-400 mt-0.5">{student.department}</p>}
          </div>
        </Card>
      )}

      {searching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}

      {!searching && courses.length > 0 && (
        <>
          {assignedCourses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Your Courses</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assignedCourses.map((c) => {
                  const colour =
                    c.total === 0
                      ? "bg-slate-100 dark:bg-slate-800"
                      : c.percentage >= 75
                      ? "bg-brand-50 dark:bg-brand-950"
                      : c.percentage >= 50
                      ? "bg-yellow-50 dark:bg-yellow-950"
                      : "bg-red-50 dark:bg-red-950";

                  return (
                    <Card key={c.courseId} className={`p-4 space-y-3 ${colour}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-slate-500" />
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                            {c.courseCode}
                          </span>
                        </div>
                        <Badge
                          variant={
                            c.total === 0 ? "slate"
                              : c.percentage >= 75 ? "green"
                              : c.percentage >= 50 ? "yellow"
                              : "red"
                          }
                        >
                          {c.total === 0 ? "No classes yet" : `${c.percentage}%`}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                        {c.courseName}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {c.attended} / {c.total} classes
                        </span>
                        {c.total > 0 && (
                          <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                c.percentage >= 75 ? "bg-brand-500"
                                  : c.percentage >= 50 ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(c.percentage, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {lockedCourses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Other Courses</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lockedCourses.map((c) => (
                  <div
                    key={c.courseId}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 opacity-50 select-none cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-mono font-bold text-slate-400">{c.courseCode}</span>
                      </div>
                      <Badge variant="slate">
                        <Lock className="w-3 h-3 mr-1 inline" />
                        Restricted
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-slate-500 leading-tight">{c.courseName}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Not assigned to you
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
