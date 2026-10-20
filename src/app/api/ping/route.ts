import { NextResponse } from "next/server";

// Tiny connectivity probe used by the offline page ("Check connection").
export const dynamic = "force-dynamic";

const res = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
export const GET = res;
export const HEAD = res;
