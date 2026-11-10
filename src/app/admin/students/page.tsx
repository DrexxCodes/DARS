"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { getAttendanceStatus } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Lock, BookOpen, UserPlus } from "lucide-react";
import RevokeAttendanceDialog from "@/components/admin/RevokeAttendanceDialog";
import MarkPresentDialog from "@/components/admin/MarkPresentDialog";
import EditStudentNameDialog from "@/components/admin/EditStudentNameDialog";
import StudentHeaderCard from "@/components/admin/StudentHeaderCard";
import StudentCourseCard from "@/components/admin/StudentCourseCard";
import DelistSheet from "@/components/course/DelistSheet";
import RelistSheet from "@/components/course/RelistSheet";
import ResetDeviceSheet from "@/components/admin/ResetDeviceSheet";
import type { CourseAttendance } from "@/types/attendance";

interface Overall { attended: number; total: number; percentage: number; courses: number }
interface StudentResult {
  regNumber: string;
  name: string;
  department?: string;
  deviceLinked?: boolean;
  deviceLinkedAt?: number | null;
}

export default function StudentSearchPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentResult | null>(null);
  const [courses, setCourses] = useState<CourseAttendance[]>([]);
  const [overall, setOverall] = useState<Overall | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [delisting, setDelisting] = useState<CourseAttendance | null>(null);
  const [relisting, setRelisting] = useState<CourseAttendance | null>(null);
  const [resetDeviceOpen, setResetDeviceOpen] = useState(false);

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
    setOverall(null);
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
      setOverall(data.overall ?? null);
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  if (authLoading || !profile?.admin) return null;

  const isSuper = profile.scope === "super";
  const visibleCourses = courses.filter((c) => !c.locked);
  const delistedCourses = visibleCourses.filter((c) => c.delisted);
  const assignedCourses = visibleCourses.filter((c) => c.offered !== false && !c.delisted); // courses the student actually takes
  const notOffered = visibleCourses.filter((c) => c.offered === false && !c.delisted);
  const overallStatus = overall ? getAttendanceStatus(overall.percentage, overall.total) : null;
  const lockedCourses = courses.filter((c) => c.locked);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Lookup</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Search by registration number to view attendance across courses
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="e.g. 2023134001"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10"
            />
          </div>
          <Button loading={searching} onClick={handleSearch}>Search</Button>
        </div>
      </Card>

      {student && (
        <StudentHeaderCard
          student={student}
          showActions={assignedCourses.length > 0}
          onEditName={() => setEditNameOpen(true)}
          onMarkPresent={() => setMarkOpen(true)}
          onRevoke={() => setRevokeOpen(true)}
          onResetDevice={isSuper ? () => setResetDeviceOpen(true) : undefined}
        />
      )}

      {!searching && student && overall && overall.courses > 0 && overallStatus && (
        <Card className={`p-4 flex items-center justify-between gap-4 ${overallStatus.card}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall attendance</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {overall.attended} / {overall.total} classes across {overall.courses} course{overall.courses === 1 ? "" : "s"} you manage
            </p>
          </div>
          <Badge variant={overallStatus.badge}>
            {overall.total === 0 ? overallStatus.label : `${overall.percentage}% · ${overallStatus.label}`}
          </Badge>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Courses this student takes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assignedCourses.map((c) => (
                  <StudentCourseCard key={c.courseId} course={c} onDelist={isSuper ? setDelisting : undefined} />
                ))}
              </div>
            </div>
          )}

          {notOffered.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Not offered by this student</p>
              <p className="text-xs text-slate-400 px-1">Your courses outside their level or department, with no approved Added Course. Not counted in the overall rate.</p>
              <div className="flex flex-wrap gap-2">
                {notOffered.map((c) => (
                  <span key={c.courseId} className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {c.courseCode}{c.attended > 0 ? ` · ${c.attended} record${c.attended === 1 ? "" : "s"}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {delistedCourses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">Delisted courses</p>
              <p className="text-xs text-slate-400 px-1">
                Their attendance for these was cleared when they were delisted. Not counted in the overall rate.
                {isSuper && " You can add them back, but the cleared attendance doesn't return."}
              </p>
              <div className="flex flex-wrap gap-2">
                {delistedCourses.map((c) =>
                  isSuper ? (
                    <button
                      key={c.courseId}
                      onClick={() => setRelisting(c)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 font-mono text-xs text-red-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-brand-950/50 dark:hover:text-brand-300"
                      title={`Add back to ${c.courseCode}`}
                    >
                      {c.courseCode}
                      <span className="inline-flex items-center gap-1 font-sans font-medium">
                        <UserPlus className="h-3 w-3" /> Add back
                      </span>
                    </button>
                  ) : (
                    <span key={c.courseId} className="text-xs font-mono px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                      {c.courseCode}
                    </span>
                  )
                )}
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

      {student && (
        <>
        <MarkPresentDialog
          open={markOpen}
          onClose={() => setMarkOpen(false)}
          onDone={handleSearch}
          student={{ regNumber: student.regNumber, name: student.name }}
          courses={assignedCourses}
        />
        <EditStudentNameDialog
          open={editNameOpen}
          onClose={() => setEditNameOpen(false)}
          onSaved={(name) => setStudent((prev) => (prev ? { ...prev, name } : prev))}
          student={{ regNumber: student.regNumber, name: student.name }}
        />
        <DelistSheet
          open={!!delisting}
          onClose={() => setDelisting(null)}
          course={delisting}
          student={{ regNumber: student.regNumber, name: student.name }}
          onDone={handleSearch}
        />
        <ResetDeviceSheet
          open={resetDeviceOpen}
          onClose={() => setResetDeviceOpen(false)}
          student={{ regNumber: student.regNumber, name: student.name }}
          onDone={handleSearch}
        />
        <RelistSheet
          open={!!relisting}
          onClose={() => setRelisting(null)}
          course={relisting}
          student={{ regNumber: student.regNumber, name: student.name }}
          onDone={handleSearch}
        />
        <RevokeAttendanceDialog
          open={revokeOpen}
          onClose={() => setRevokeOpen(false)}
          onDone={handleSearch}
          student={{ regNumber: student.regNumber, name: student.name }}
          courses={assignedCourses}
        />
        </>
      )}
    </div>
  );
}
