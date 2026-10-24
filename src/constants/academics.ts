/** Academic calendar + programme settings. Mirrors the NPS app: the session starts in October (UTC month). */
export const ACADEMIC_SESSION_START_MONTH = 10;

/** Political Science is a 4-year programme. Students past it (spill-over years) stay on the final level. */
export const COURSE_DURATION_YEARS = 4;

/** Selectable levels ("student classes") a course can be assigned to. */
export const LEVELS = [100, 200, 300, 400] as const;
export type Level = (typeof LEVELS)[number];

export const levelLabel = (level: number) => `${level} Level`;

/**
 * Departments a course can be restricted to, told apart by the 3-digit code inside the reg number (20YY CCC NNN).
 * A course with no departments set is open to both.
 */
export const DEPARTMENTS = [
  { id: "pol", label: "Political Science", codes: ["133", "134"] },
  { id: "edu", label: "Political Science Education", codes: ["173", "174"] },
] as const;
export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];
export const departmentLabel = (id: string) => DEPARTMENTS.find((d) => d.id === id)?.label ?? id;

/**
 * Admission type, told apart by the same 3-digit code: 134 (Political Science) and 174 (Education) are Regular;
 * 133 (Political Science) and 173 (Education) are CEP. A course with no admission types set is for both.
 */
export const ADMISSION_TYPES = [
  { id: "regular", label: "Regular", codes: ["134", "174"] },
  { id: "cep", label: "CEP", codes: ["133", "173"] },
] as const;
export type AdmissionTypeId = (typeof ADMISSION_TYPES)[number]["id"];
export const admissionTypeLabel = (id: string) => ADMISSION_TYPES.find((t) => t.id === id)?.label ?? id;
