/**
 * Scopes a scoped admin (scope === "defined") can be granted. Super admins hold every scope and are never limited.
 * A scope is checked IN ADDITION to course assignment: scoped admins only ever act on courses assigned to them.
 */
export const SCOPE_KEYS = [
  "class.create",
  "class.end",
  "class.pause",
  "class.extend",
  "class.delete",
  "course.create",
  "course.delete",
  "course.student.enlist",
  "course.student.delist",
  "student.lookup",
  "student.mark",
  "student.delete",
  "tags.create",
  "tags.delete",
  "tags.edit",
] as const;

export type ScopeKey = (typeof SCOPE_KEYS)[number];

export type ScopeGroup = "Classes" | "Courses" | "Students" | "Location tags";

export interface ScopeDef {
  key: ScopeKey;
  group: ScopeGroup;
  label: string;
  description: string;
}

export const SCOPES: ScopeDef[] = [
  { key: "class.create", group: "Classes", label: "Start classes", description: "Start a class for an assigned course." },
  { key: "class.end", group: "Classes", label: "End classes", description: "End a running class." },
  { key: "class.pause", group: "Classes", label: "Pause / resume check-in", description: "Pause and resume check-in during a class." },
  { key: "class.extend", group: "Classes", label: "Extend classes", description: "Add time to a running class or re-open one that was ended." },
  { key: "class.delete", group: "Classes", label: "Delete class days", description: "Delete a class day and its attendance records." },
  { key: "course.create", group: "Courses", label: "Create courses", description: "Create a course (it is assigned to them automatically)." },
  { key: "course.delete", group: "Courses", label: "Delete courses", description: "Delete an assigned course and everything under it." },
  { key: "course.student.enlist", group: "Courses", label: "Enlist students", description: "Approve Added Course requests and add delisted students back." },
  { key: "course.student.delist", group: "Courses", label: "Delist students", description: "Remove a student from a course and clear their attendance for it." },
  { key: "student.lookup", group: "Students", label: "Look up & edit students", description: "Search students, see their email and edit them: name, password reset email, disable / enable." },
  { key: "student.mark", group: "Students", label: "Mark / revoke for students", description: "Mark students present or revoke a day. Can be capped per class." },
  { key: "student.delete", group: "Students", label: "Delete students", description: "Permanently delete a student account and all of their attendance." },
  { key: "tags.create", group: "Location tags", label: "Create tags", description: "Capture and save new location tags." },
  { key: "tags.edit", group: "Location tags", label: "Edit tags", description: "Change a tag's check-in range or primary tag." },
  { key: "tags.delete", group: "Location tags", label: "Delete tags", description: "Delete location tags." },
];

export const SCOPE_GROUPS: ScopeGroup[] = ["Classes", "Courses", "Students", "Location tags"];

export const scopeDef = (key: string): ScopeDef | undefined => SCOPES.find((s) => s.key === key);
export const isScopeKey = (v: unknown): v is ScopeKey => typeof v === "string" && (SCOPE_KEYS as readonly string[]).includes(v);

/**
 * What scoped admins could already do before scopes existed. An admin saved without a `scopes` field keeps exactly this,
 * so nothing breaks on deploy. Saving their role once writes an explicit list.
 */
export const LEGACY_DEFAULT_SCOPES: ScopeKey[] = ["class.create", "class.end", "class.pause", "student.lookup", "student.mark"];

/** `student.mark` can be capped: how many students a scoped admin may mark for, in each class. */
export const MARK_LIMIT = { MIN: 1, MAX: 1000 } as const;

export interface ScopeLimits {
  /** Max students this admin may mark in ONE class. Missing / null = unlimited. */
  "student.mark"?: number | null;
}

/** Error code sent with a 403 when an admin goes beyond their scope. The client answers it with the "Out of Scope" sheet. */
export const OUT_OF_SCOPE_CODE = "OUT_OF_SCOPE";

export type OutOfScopeReason = "missing" | "limit";

export const outOfScopeMessage = (scope: string) =>
  `The resource you're trying to access from this server is bound under the ${scope} scope. You either don't have access to this scope or you have exceeded the limits provided for this scope.`;

interface ScopeSubject {
  admin?: boolean;
  scope?: "super" | "defined" | null;
  scopes?: unknown;
}

/** The scopes this admin effectively holds. Super admins: all of them. No stored list: the legacy defaults. */
export function resolveScopes(subject: ScopeSubject | null | undefined): ScopeKey[] {
  if (!subject?.admin) return [];
  if (subject.scope === "super") return [...SCOPE_KEYS];
  if (Array.isArray(subject.scopes)) return subject.scopes.filter(isScopeKey);
  return [...LEGACY_DEFAULT_SCOPES];
}

/** Reads and validates a `{ scopes, scopeLimits }` pair from a request body. */
export function parseScopeInput(
  rawScopes: unknown,
  rawLimits: unknown
): { ok: true; scopes: ScopeKey[]; scopeLimits: ScopeLimits } | { ok: false; error: string } {
  if (!Array.isArray(rawScopes)) return { ok: false, error: "Scopes must be a list." };
  if (rawScopes.some((s) => !isScopeKey(s))) return { ok: false, error: "One or more scopes are not recognised." };
  const scopes = [...new Set(rawScopes as ScopeKey[])];

  const scopeLimits: ScopeLimits = {};
  const limits = rawLimits && typeof rawLimits === "object" ? (rawLimits as Record<string, unknown>) : {};
  const raw = limits["student.mark"];
  if (raw !== undefined && raw !== null && raw !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < MARK_LIMIT.MIN || n > MARK_LIMIT.MAX) {
      return { ok: false, error: `The mark limit must be a whole number from ${MARK_LIMIT.MIN} to ${MARK_LIMIT.MAX}.` };
    }
    scopeLimits["student.mark"] = n;
  } else {
    scopeLimits["student.mark"] = null;
  }
  return { ok: true, scopes, scopeLimits };
}
