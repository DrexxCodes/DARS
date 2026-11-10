import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";
import { REG_NUMBER_REGEX } from "@/lib/utils";
import { bindingRef } from "@/lib/device-binding";

type Ctx = { params: Promise<{ regNumber: string }> };

// DELETE — a super admin unlinks a student's phone/browser (new phone, cleared browser data, installed the app).
// The student's next successful self-mark links whatever device they use then.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await verifyAdmin(req);
    if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Super admin access required" }, { status: 403 });

    const reg = (await ctx.params).regNumber.trim().toUpperCase();
    if (!REG_NUMBER_REGEX.test(reg)) return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });

    const studentRef = db.collection("students").doc(reg);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const did: unknown = studentDoc.data()?.boundDevice?.did;
    if (typeof did !== "string") return NextResponse.json({ error: "That student has no linked device." }, { status: 400 });

    // Only remove the browser's link doc if it still points at this student
    const linkSnap = await bindingRef(did).get();
    const batch = db.batch();
    batch.update(studentRef, { boundDevice: FieldValue.delete() });
    if (linkSnap.exists && linkSnap.data()?.regNumber === reg) batch.delete(linkSnap.ref);
    await batch.commit();

    await db.collection("activityLog").add({
      action: "reset_device",
      regNumber: reg,
      studentName: studentDoc.data()?.name ?? null,
      adminUid: admin.uid,
      adminName: admin.name,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset device error:", error);
    return NextResponse.json({ error: "Couldn't reset the device. Please try again." }, { status: 500 });
  }
}
