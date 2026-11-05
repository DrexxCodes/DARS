import { db } from "@/lib/firebase-admin";
import { isClassExpired } from "@/lib/utils";
import { ttlCache } from "@/lib/ttl-cache";

export interface LiveClass {
  courseId: string;
  classId: string;
  startTime: number;
}

// One cheap query (only active classes come back) shared by every request on this instance for a few seconds.
const cache = ttlCache<Map<string, LiveClass>>(4_000);

/**
 * Classes running right now, keyed by course id. "Running" = the lecturer started it and hasn't ended it, and it's
 * inside the 2-hour check-in window (a class nobody ended stops counting once the window closes, same as marking).
 */
export function loadLiveClasses(): Promise<Map<string, LiveClass>> {
  return cache.get("live", async () => {
    const snap = await db.collection("globals").where("classActive", "==", true).get();
    const live = new Map<string, LiveClass>();
    for (const d of snap.docs) {
      const g = d.data();
      if (typeof g.currentClassId !== "string" || typeof g.startTime !== "number" || isClassExpired(g.startTime)) continue;
      live.set(d.id, { courseId: d.id, classId: g.currentClassId, startTime: g.startTime });
    }
    return live;
  });
}
