import { NextResponse } from "next/server";
import { OUT_OF_SCOPE_CODE, outOfScopeMessage, resolveScopes, type OutOfScopeReason, type ScopeKey } from "@/constants/scopes";
import type { AdminUser } from "@/lib/admin-auth";

/** 403 the client turns into the "Out of Scope" sheet. */
export function outOfScope(scope: ScopeKey, reason: OutOfScopeReason = "missing", message?: string) {
  return NextResponse.json({ error: message ?? outOfScopeMessage(scope), code: OUT_OF_SCOPE_CODE, scope, reason }, { status: 403 });
}

export const hasScope = (admin: AdminUser, scope: ScopeKey): boolean => resolveScopes(admin).includes(scope);

/** Returns the "Out of Scope" response when the admin doesn't hold the scope, otherwise null. Super admins always pass. */
export const requireScope = (admin: AdminUser, scope: ScopeKey) => (hasScope(admin, scope) ? null : outOfScope(scope));

/** Max students this admin may mark in one class, or null for no cap (super admins and uncapped scoped admins). */
export function markLimitFor(admin: AdminUser): number | null {
  if (admin.scope === "super") return null;
  const n = admin.scopeLimits?.["student.mark"];
  return typeof n === "number" && n > 0 ? n : null;
}

export const markLimitMessage = (limit: number) =>
  `The resource you're trying to access from this server is bound under the student.mark scope. You either don't have access to this scope or you have exceeded the limits provided for this scope. Your limit is ${limit} student${limit === 1 ? "" : "s"} per class and you've used all of them for this class.`;
