import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase-admin";
import { REG_NUMBER_REGEX } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, name, regNumber } = body;
    const email: string = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Sign-in uses the NEXT_PUBLIC_* client config, signup uses the service account.
    // If they point at different Firebase projects, users are created in one project and
    // looked up in another -> "invalid email or password" on every login.
    if (
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== process.env.FIREBASE_PROJECT_ID
    ) {
      console.error(
        "FIREBASE PROJECT MISMATCH: admin =", process.env.FIREBASE_PROJECT_ID,
        "client =", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      );
    }

    if (!email || !password || !name || !regNumber) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const normalized = regNumber.trim().toUpperCase();
    if (!REG_NUMBER_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid registration number format." },
        { status: 400 }
      );
    }

    // Check if reg number already exists
    const studentDoc = await db.collection("students").doc(normalized).get();
    if (studentDoc.exists) {
      return NextResponse.json(
        { error: "This registration number is already registered." },
        { status: 409 }
      );
    }

    // Create Firebase auth user
    const userRecord = await auth.createUser({ email, password, displayName: name });

    const now = Date.now();

    // Create user profile
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      regNumber: normalized,
      admin: false,
      scope: null,
      assignedCourses: [],
      banned: false,
      createdAt: now,
    });

    // Create student record
    await db.collection("students").doc(normalized).set({
      uid: userRecord.uid,
      name,
      email,
      regNumber: normalized,
      totalPresence: 0,
      createdAt: now,
    });

    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
