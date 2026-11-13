import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { verifyAdmin, isSuperAdmin } from "@/lib/admin-auth";
import { requireScope } from "@/lib/scopes";
import { parseAdmissionTypes, parseDepartments, parseLevels } from "@/lib/admission";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all");

    if (all) {
      const snap = await db.collection("courses").orderBy("createdAt", "desc").get();
      const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ courses });
    }

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
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const denied = requireScope(admin, "course.create");
  if (denied) return denied;

  try {
    const { name, code, description, levels: rawLevels, departments: rawDepartments, admissionTypes: rawAdmissionTypes } = await req.json();
    if (!name || !code) {
      return NextResponse.json({ error: "Course name and code are required." }, { status: 400 });
    }
    // Levels this course is assigned to; empty = open to every level
    const levels = rawLevels === undefined ? [] : parseLevels(rawLevels);
    if (!levels) return NextResponse.json({ error: "Invalid levels." }, { status: 400 });
    // Departments this course is restricted to; empty = open to every department
    const departments = rawDepartments === undefined ? [] : parseDepartments(rawDepartments);
    if (!departments) return NextResponse.json({ error: "Invalid departments." }, { status: 400 });
    // Admission types (regular / CEP) this course is for; empty = both
    const admissionTypes = rawAdmissionTypes === undefined ? [] : parseAdmissionTypes(rawAdmissionTypes);
    if (!admissionTypes) return NextResponse.json({ error: "Invalid admission types." }, { status: 400 });

    const now = Date.now();
    const ref = await db.collection("courses").add({
      name,
      code: code.toUpperCase(),
      description: description || "",
      levels,
      departments,
      admissionTypes,
      // A scoped admin who creates a course gets it assigned, otherwise they could never see it
      assignedAdmins: admin.scope === "defined" ? [admin.uid] : [],
      active: true,
      totalClasses: 0,   // ← denormalized counter
      createdAt: now,
      createdBy: admin.uid,
    });

    // Init globals for this course
    await db.collection("globals").doc(ref.id).set({
      courseId: ref.id,
      classActive: false,
      checkinPaused: false,
      currentClassId: null,
      startTime: null,
      endTime: null,
    });

    if (admin.scope === "defined") {
      await db.collection("users").doc(admin.uid).update({ assignedCourses: FieldValue.arrayUnion(ref.id) });
    }

    await db.collection("activityLog").add({
      action: "create_course",
      courseId: ref.id,
      courseName: name,
      adminUid: admin.uid,
      adminName: admin.name,
      timestamp: now,
    });

    return NextResponse.json({ success: true, courseId: ref.id }, { status: 201 });
  } catch (error) {
    console.error("Create course error:", error);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adminUser = await verifyAdmin(req);
  if (!isSuperAdmin(adminUser)) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  try {
    const { courseId, assignedAdmins, active, levels, departments, admissionTypes } = await req.json();
    const update: Record<string, unknown> = {};
    if (levels !== undefined) {
      const parsed = parseLevels(levels);
      if (!parsed) return NextResponse.json({ error: "Invalid levels." }, { status: 400 });
      update.levels = parsed;
    }
    if (departments !== undefined) {
      const parsed = parseDepartments(departments);
      if (!parsed) return NextResponse.json({ error: "Invalid departments." }, { status: 400 });
      update.departments = parsed;
    }
    if (admissionTypes !== undefined) {
      const parsed = parseAdmissionTypes(admissionTypes);
      if (!parsed) return NextResponse.json({ error: "Invalid admission types." }, { status: 400 });
      update.admissionTypes = parsed;
    }
    if (assignedAdmins !== undefined) update.assignedAdmins = assignedAdmins;
    if (active !== undefined) update.active = active;

    if (typeof courseId !== "string" || !courseId) return NextResponse.json({ error: "courseId required." }, { status: 400 });
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    await db.collection("courses").doc(courseId).update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update course error:", error);
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}
