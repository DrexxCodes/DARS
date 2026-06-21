import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const body = await req.json();

    // Only allow safe fields to be updated
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
