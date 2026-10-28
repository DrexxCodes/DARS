import { hasBirthday } from "@/lib/birthday";

/**
 * What the DARS client may see of a users/{uid} document. users/{uid} is shared with NPS, so the raw document also holds
 * bank details, phone, date of birth and emergency contacts; none of that should ever reach a browser through this API.
 */
export function toClientProfile(uid: string, data: Record<string, unknown>) {
  return {
    uid,
    email: data.email ?? "",
    name: data.name ?? data.fullName ?? "",
    regNumber: data.regNumber ?? undefined,
    admin: data.admin === true,
    scope: data.scope ?? undefined,
    assignedCourses: Array.isArray(data.assignedCourses) ? data.assignedCourses : [],
    excludeFromExports: data.excludeFromExports === true ? true : undefined,
    banned: data.banned === true,
    createdAt: data.createdAt ?? undefined,
    /** A yes/no only: the date itself is never sent to the client. */
    birthdayProvided: hasBirthday(data),
  };
}
