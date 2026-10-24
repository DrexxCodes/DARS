import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { ttlCache } from "@/lib/ttl-cache";
import type { MarkStatusPayload } from "@/types/mark";

// One shared snapshot per server instance: a whole lecture hall polling this costs one Firestore read round, not 200.
const cache = ttlCache<MarkStatusPayload>(4_000);

/**
 * Everything the student "Mark Attendance" page needs, in one request (was two: /api/courses + /api/globals).
 * Only public, non-sensitive fields are returned (no currentClassId / locationId).
 */
export async function GET() {
  try {
    const payload = await cache.get("status", async () => {
      const [coursesSnap, globalsSnap] = await Promise.all([
        db.collection("courses").where("active", "==", true).get(),
        db.collection("globals").get(),
      ]);

      const courses = coursesSnap.docs.map((d) => {
        const c = d.data();
        return {
          id: d.id,
          name: String(c.name ?? ""),
          code: String(c.code ?? ""),
          levels: Array.isArray(c.levels) ? (c.levels as number[]) : [], // empty = every level
          departments: Array.isArray(c.departments) ? (c.departments as string[]) : [], // empty = every department
          admissionTypes: Array.isArray(c.admissionTypes) ? (c.admissionTypes as string[]) : [], // empty = regular and CEP
        };
      });
      const activeIds = new Set(courses.map((c) => c.id));

      const globals = globalsSnap.docs
        .filter((d) => activeIds.has(d.id))
        .map((d) => {
          const g = d.data();
          return {
            id: d.id,
            classActive: !!g.classActive,
            checkinPaused: !!g.checkinPaused,
            startTime: typeof g.startTime === "number" ? g.startTime : null,
          };
        });

      return { courses, globals };
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=6" },
    });
  } catch (error) {
    console.error("Mark status error:", error);
    return NextResponse.json({ error: "Failed to fetch class status" }, { status: 500 });
  }
}
