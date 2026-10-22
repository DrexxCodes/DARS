"use client";

import { useCallback, useEffect, useState } from "react";
import type { Course, GlobalState, MarkStatusPayload } from "@/types/mark";

const CACHE_KEY = "dars:mark-status";
const CACHE_MAX_AGE_MS = 2 * 60_000;
const POLL_MS = 20_000;

function readCache(): { at: number; data: MarkStatusPayload } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Courses + live class state for the mark page.
 *  - one request instead of two,
 *  - shows the last snapshot instantly (if < 2 min old) while the fresh one loads,
 *  - polls only while the tab is visible, and refreshes the moment the student returns to the app.
 */
export function useMarkStatus() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [globals, setGlobals] = useState<Record<string, GlobalState>>({});
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: MarkStatusPayload) => {
    setCourses(data.courses || []);
    const map: Record<string, GlobalState> = {};
    for (const g of data.globals || []) map[g.id] = g;
    setGlobals(map);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/mark/status");
      if (!res.ok) throw new Error("status failed");
      const data = (await res.json()) as MarkStatusPayload;
      apply(data);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
      } catch {}
    } catch {
      // keep whatever we already have (offline / flaky network)
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.at < CACHE_MAX_AGE_MS) {
      apply(cached.data);
      setLoading(false);
    }
    refresh();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, refresh]);

  return { courses, globals, loading, refresh };
}
