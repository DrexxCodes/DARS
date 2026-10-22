"use client";

import { useCallback, useEffect, useState } from "react";
import { clientAuth } from "@/lib/firebase-client";
import type { CarryoverEntry } from "@/types/mark";

/** The signed-in student's carry-over applications (courses outside their level and where each one stands). */
export function useCarryovers(enabled: boolean) {
  const [entries, setEntries] = useState<CarryoverEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/mark/carryover", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEntries((await res.json()).entries ?? []);
    } catch {
      // keep what we have (offline / flaky network)
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // Pick up an admin's decision when the student comes back to the app
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  return { entries, refresh };
}
