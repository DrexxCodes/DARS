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
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all");

    if (all) {
      // Return all courses (for admin views)
      const snap = await db.collection("courses").orderBy("createdAt", "desc").get();
      const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ courses });
    }

    // Return active courses for mark page
    const snap = await db.collection("courses").where("active", "==", true).get();
    const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ courses });
  } catch (error) {
    console.error("Get courses error:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin || admin.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  try {
    const { name, code, description } = await req.json();
    if (!name || !code) {
      return NextResponse.json({ error: "Course name and code are required." }, { status: 400 });
    }

    const now = Date.now();
    const ref = await db.collection("courses").add({
      name,
      code: code.toUpperCase(),
      description: description || "",
      assignedAdmins: [],
      active: true,
      createdAt: now,
      createdBy: admin.uid,
    });

    // Initialize globals for this course
    await db.collection("globals").doc(ref.id).set({
      courseId: ref.id,
      classActive: false,
      checkinPaused: false,
      currentDate: null,
      startTime: null,
      endTime: null,
    });

    return NextResponse.json({ success: true, courseId: ref.id }, { status: 201 });
  } catch (error) {
    console.error("Create course error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!adminUser || adminUser.scope !== "super") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  try {
    const { courseId, assignedAdmins, active } = await req.json();
    const update: Record<string, unknown> = {};
    if (assignedAdmins !== undefined) update.assignedAdmins = assignedAdmins;
    if (active !== undefined) update.active = active;

    await db.collection("courses").doc(courseId).update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update course error:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}
