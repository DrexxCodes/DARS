import { NextRequest, NextResponse } from "next/server";
import { grantAdmin } from "@/lib/admin-grant";

// POST /api/admin/add — grant admin access to an existing DARS account by email (super admins only).
// Body: { email, scope?: "super" | "defined" (default "defined"), assignedCourses?: string[] }
export async function POST(req: NextRequest) {
  try {
    const { status, body } = await grantAdmin(req);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Grant admin error:", error);
    return NextResponse.json({ error: "Failed to grant admin access." }, { status: 500 });
  }
}
