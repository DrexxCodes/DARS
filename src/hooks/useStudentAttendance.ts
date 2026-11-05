"use client";

import { useCallback, useEffect, useState } from "react";
import { clientAuth } from "@/lib/firebase-client";
import type { CourseAttendance } from "@/types/attendance";

/**
 * The signed-in student's attendance per course (the courses they take: delisted ones are left out server-side).
 * Refreshes when they come back to the app, so a class they just marked, or one that just started, shows up without a reload.
 */
export function useStudentAttendance(regNumber: string | undefined, fallbackName: string) {
  const [courses, setCourses] = useState<CourseAttendance[]>([]);
  const [studentName, setStudentName] = useState(fallbackName);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!regNumber) return;
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/students/${regNumber}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) {
        setCourses(json.courses || []);
        setStudentName(json.student?.name || fallbackName);
      }
    } catch {
      // keep what we have (offline / flaky network)
    } finally {
      setLoading(false);
    }
  }, [regNumber, fallbackName]);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return { courses, studentName, loading, refresh };
}
