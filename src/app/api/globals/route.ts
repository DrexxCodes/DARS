import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (courseId) {
      const doc = await db.collection("globals").doc(courseId).get();
      if (!doc.exists) return NextResponse.json({ global: null });
      return NextResponse.json({ global: { id: doc.id, ...doc.data() } });
    }

    // Return all globals (excluding the locationConfig anchor doc, which
    // holds the `locations` subcollection rather than course class state)
    const snap = await db.collection("globals").get();
    const globals = snap.docs
      .filter((d) => d.id !== "locationConfig")
      .map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ globals });
  } catch (error) {
    console.error("Globals error:", error);
    return NextResponse.json({ error: "Failed to fetch class status" }, { status: 500 });
  }
}
