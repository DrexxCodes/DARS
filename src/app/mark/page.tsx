"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, Spinner } from "@/components/ui";
import CourseSelector from "@/components/mark/CourseSelector";
import MarkButton from "@/components/mark/MarkButton";
import ClassStatusBanner from "@/components/mark/ClassStatusBanner";
import SuccessCard from "@/components/mark/SuccessCard";
import LocationGate from "@/components/mark/LocationGate";
import { Dialog, Button } from "@/components/ui";
import { AlertCircle, UserX, Clock, PauseCircle, ArrowLeft, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Course { id: string; name: string; code: string; }
interface GlobalState { classActive: boolean; checkinPaused: boolean; startTime: number | null; currentDate: string; }

type DialogType = "not_found" | "ended" | "paused" | null;

export default function MarkPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [globals, setGlobals] = useState<Record<string, GlobalState>>({});
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [success, setSuccess] = useState<{ name: string; late: boolean; timestamp: number } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [coursesRes, globalsRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/globals"),
      ]);
      const { courses: c } = await coursesRes.json();
      const { globals: g } = await globalsRes.json();

      setCourses(c || []);

      const globalsMap: Record<string, GlobalState> = {};
      for (const gl of (g || [])) {
        globalsMap[gl.id] = gl;
      }
      setGlobals(globalsMap);
    } catch {
      // silent
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 30s to catch class start/end/pause
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Marking attendance now requires being signed in.
  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <Spinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          <Card className="p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center mx-auto">
              <LogIn className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sign In Required</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                You must sign in with your DARS account before you can mark attendance.
              </p>
            </div>
            <Link href="/auth/login">
              <Button className="w-full" size="lg" icon={<LogIn className="w-5 h-5" />}>
                Sign In
              </Button>
            </Link>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                Register here
              </Link>
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (!location) {
    return <LocationGate onGranted={setLocation} />;
  }

  const selectedGlobal = selectedCourse ? globals[selectedCourse] : null;
  const selectedCourseName = courses.find((c) => c.id === selectedCourse)?.name || "";

  const handleCourseSelect = (id: string) => {
    setSelectedCourse(id);
    setSuccess(null);
    const g = globals[id];
    if (g?.classActive === false) {
      setDialog("ended");
    } else if (g?.checkinPaused) {
      setDialog("paused");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mark Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            UNIZIK · Political Science Department
          </p>
        </div>

        <Card className="p-6">
          {!selectedCourse ? (
            <>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wide">
                Select Course
              </h2>
              <CourseSelector
                courses={courses}
                globals={globals as Record<string, { classActive: boolean; checkinPaused: boolean; startTime: number }>}
                selected={selectedCourse}
                onSelect={handleCourseSelect}
                loading={loadingCourses}
              />
            </>
          ) : success ? (
            <>
              <SuccessCard
                name={success.name}
                late={success.late}
                timestamp={success.timestamp}
                courseName={selectedCourseName}
                onMarkAnother={() => {
                  setSelectedCourse(null);
                  setSuccess(null);
                }}
              />
            </>
          ) : (
            <>
              {/* Back button */}
              <button
                onClick={() => { setSelectedCourse(null); setSuccess(null); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors mb-5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to courses
              </button>

              {/* Class status banner */}
              {selectedGlobal && (
                <div className="mb-5">
                  <ClassStatusBanner
                    classActive={selectedGlobal.classActive}
                    checkinPaused={selectedGlobal.checkinPaused}
                    startTime={selectedGlobal.startTime}
                    onExpired={() => setDialog("ended")}
                  />
                </div>
              )}

              <MarkButton
                courseId={selectedCourse}
                courseName={selectedCourseName}
                lat={location.lat}
                lng={location.lng}
                onSuccess={(result) => setSuccess(result)}
                onNotFound={() => setDialog("not_found")}
              />
            </>
          )}
        </Card>
      </div>

      {/* Not Found Dialog */}
      <Dialog
        open={dialog === "not_found"}
        onClose={() => setDialog(null)}
        title="Student Not Found"
        variant="warning"
        icon={<UserX className="w-5 h-5" />}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
          DARS couldn&apos;t find that registration number. If you&apos;re in{" "}
          <strong>200 Level Political Science</strong>, you may not be registered yet.
        </p>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => { setDialog(null); router.push("/auth/register"); }}>
            Register Now
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setDialog(null)}>
            Try Again
          </Button>
        </div>
      </Dialog>

      {/* Class Ended Dialog */}
      <Dialog
        open={dialog === "ended"}
        onClose={() => setDialog(null)}
        title="Class Has Ended"
        variant="danger"
        icon={<Clock className="w-5 h-5" />}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
          The class session for this course has ended or check-in is no longer available. Please contact your lecturer.
        </p>
        <Button variant="outline" className="w-full" onClick={() => { setDialog(null); setSelectedCourse(null); }}>
          Go Back
        </Button>
      </Dialog>

      {/* Paused Dialog */}
      <Dialog
        open={dialog === "paused"}
        onClose={() => setDialog(null)}
        title="Check-in Paused"
        variant="warning"
        icon={<PauseCircle className="w-5 h-5" />}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
          Attendance check-in for this course has been temporarily paused by the lecturer. Please wait for it to resume.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => setDialog(null)}>
          OK
        </Button>
      </Dialog>

      {/* Alert icon for general */}
      <span className="hidden"><AlertCircle /></span>
    </div>
  );
}
