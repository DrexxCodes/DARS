import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    return NextResponse.json({ user: { uid: decoded.uid, ...userDoc.data() } });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
