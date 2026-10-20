import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";

async function getCaller(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    const doc = await db.collection("users").doc(decoded.uid).get();
    return { uid: decoded.uid, data: doc.exists ? doc.data()! : null };
  } catch {
    return null;
  }
}

// GET /api/users/[uid] — a user may read their own profile; admins may read any
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (caller.uid !== uid && !caller.data?.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: { uid, ...userDoc.data() } });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PATCH /api/users/[uid] — super admins only (previously unauthenticated: anyone could self-promote)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const caller = await getCaller(req);
    if (!caller?.data?.admin || caller.data.scope !== "super") {
      return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
    }
    const body = await req.json();

    const allowed = ["name", "admin", "scope", "assignedCourses", "banned"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    await db.collection("users").doc(uid).update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
