import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) return null;
    const user = userDoc.data()!;
    if (!user.admin) return null;
    return { uid: decoded.uid, ...user };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const limitN = parseInt(searchParams.get("limit") || "20");

    let query = db.collection("activityLog").orderBy("timestamp", "desc").limit(limitN);
    if (courseId) {
      query = db.collection("activityLog")
        .where("courseId", "==", courseId)
        .orderBy("timestamp", "desc")
        .limit(limitN) as typeof query;
    }

    const snap = await query.get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
  }
}
