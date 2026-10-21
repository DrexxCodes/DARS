import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";
import { RESET_PHRASE } from "@/constants/reset";
import type { ResetCounts } from "@/types/admin";

// A big reset can take a while. It is safe to run again if it ever times out: every step is idempotent.
export const maxDuration = 60;

const countOf = async (q: { count: () => { get: () => Promise<{ data: () => { count: number } }> } }) => {
  try {
    return (await q.count().get()).data().count;
  } catch {
    return null;
  }
};

async function getCounts(): Promise<ResetCounts> {
  const [students, courses, sessions, records] = await Promise.all([
    countOf(db.collection("students")),
    countOf(db.collection("courses")),
    countOf(db.collectionGroup("sessions")),
    countOf(db.collectionGroup("records")),
  ]);
  return { students, courses, sessions, records };
}

// GET — what a reset would delete (super admin only)
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  return NextResponse.json({ counts: await getCounts() });
}

// POST — wipe all classes and attendance history. Keeps students, courses, admins and location tags.
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

  try {
    const { confirmation } = await req.json();
    if (typeof confirmation !== "string" || confirmation.trim() !== RESET_PHRASE) {
      return NextResponse.json({ error: `Type "${RESET_PHRASE}" exactly to confirm.` }, { status: 400 });
    }

    const counts = await getCounts();

    // 1. Close every live class first, so nobody can mark attendance while data is being removed
    const coursesSnap = await db.collection("courses").get();
    for (let i = 0; i < coursesSnap.docs.length; i += 200) {
      const batch = db.batch();
      for (const course of coursesSnap.docs.slice(i, i + 200)) {
        batch.set(
          db.collection("globals").doc(course.id),
          { classActive: false, checkinPaused: false, currentClassId: null, startTime: null, endTime: null },
          { merge: true }
        );
        batch.update(course.ref, { totalClasses: 0 });
      }
      await batch.commit();
    }

    // 2. All class sessions (class history), including their device claims
    await db.recursiveDelete(db.collection("classes"));

    // 3. Every student's attendance history, and their counters back to zero. The students themselves stay.
    const studentsSnap = await db.collection("students").select().get();
    const CONCURRENCY = 10;
    for (let i = 0; i < studentsSnap.docs.length; i += CONCURRENCY) {
      await Promise.all(
        studentsSnap.docs.slice(i, i + CONCURRENCY).map(async (s) => {
          await db.recursiveDelete(s.ref.collection("attendance"));
          await s.ref.update({ totalPresence: 0 });
        })
      );
    }

    // 4. Keep the audit trail, and record who did this
    await db.collection("activityLog").add({
      action: "reset_all",
      adminUid: admin.uid,
      adminName: admin.name,
      studentsAffected: studentsSnap.size,
      sessionsDeleted: counts.sessions,
      recordsDeleted: counts.records,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Reset didn't finish. Some data may already be gone. Run it again to complete it." },
      { status: 500 }
    );
  }
}
