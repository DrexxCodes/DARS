import { ACADEMIC_SESSION_START_MONTH, ADMISSION_TYPES, COURSE_DURATION_YEARS, DEPARTMENTS, LEVELS, type AdmissionTypeId, type DepartmentId } from "@/constants/academics";
import { REG_NUMBER_REGEX } from "@/lib/utils";

/**
 * Same logic NPS uses (src/lib/admission.ts): the admission year is the first four digits of the number
 * (YYYYCCCNNN), and the academic year steps up each October.
 */
export function admissionYearOf(regNumber: string | null | undefined): number | null {
  return regNumber && /^\d{10}$/.test(regNumber) ? Number(regNumber.slice(0, 4)) : null;
}

/** Academic year number (1 = first year) from the admission year, using the October session boundary. */
export function academicYear(admissionYear: number, reference: Date, sessionStartMonth = ACADEMIC_SESSION_START_MONTH): number {
  const y = reference.getUTCFullYear();
  const month = reference.getUTCMonth() + 1;
  return month >= sessionStartMonth ? y - admissionYear + 1 : y - admissionYear;
}

/**
 * The student's level (100, 200, 300, 400) from their registration number, or null if it has no usable year.
 * Clamped to 100..(duration x 100): a student admitted this year before October still counts as 100 Level, and a
 * student beyond the programme length stays on the final level instead of seeing nothing.
 */
export function levelOf(regNumber: string | null | undefined, now: Date = new Date()): number | null {
  const year = admissionYearOf(regNumber);
  if (!year) return null;
  const clamped = Math.min(Math.max(academicYear(year, now), 1), COURSE_DURATION_YEARS);
  return clamped * 100;
}

/** A course with no levels set is open to every level (so existing courses keep working). A null level (e.g. an admin without a reg number) sees everything. */
export function courseVisibleToLevel(levels: readonly number[] | null | undefined, level: number | null): boolean {
  if (!levels || levels.length === 0 || level === null) return true;
  return levels.includes(level);
}

/** Validates a levels payload from a request body. Returns a de-duplicated, sorted list, or null if invalid. */
export function parseLevels(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set<number>(LEVELS);
  const out: number[] = [];
  for (const v of input) {
    if (typeof v !== "number" || !allowed.has(v)) return null;
    if (!out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

/** The student's department id from the 3-digit code in their reg number (20YY CCC NNN), or null if unrecognised. */
export function departmentOf(regNumber: string | null | undefined): DepartmentId | null {
  if (!regNumber || !/^\d{10}$/.test(regNumber)) return null;
  const code = regNumber.slice(4, 7);
  return DEPARTMENTS.find((d) => (d.codes as readonly string[]).includes(code))?.id ?? null;
}

/** A course with no departments set is open to every department. A null department (unrecognised number) sees everything. */
export function courseVisibleToDepartment(departments: readonly string[] | null | undefined, department: string | null): boolean {
  if (!departments || departments.length === 0 || department === null) return true;
  return departments.includes(department);
}

/** Validates a departments payload. Returns a de-duplicated list, or null if invalid. */
export function parseDepartments(input: unknown): DepartmentId[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set<string>(DEPARTMENTS.map((d) => d.id));
  const out: DepartmentId[] = [];
  for (const v of input) {
    if (typeof v !== "string" || !allowed.has(v)) return null;
    if (!out.includes(v as DepartmentId)) out.push(v as DepartmentId);
  }
  return out;
}

/** The student's admission type (regular or CEP) from the 3-digit code in their reg number, or null if unrecognised. */
export function admissionTypeOf(regNumber: string | null | undefined): AdmissionTypeId | null {
  if (!regNumber || !/^\d{10}$/.test(regNumber)) return null;
  const code = regNumber.slice(4, 7);
  return ADMISSION_TYPES.find((t) => (t.codes as readonly string[]).includes(code))?.id ?? null;
}

/** A course with no admission types set is for both regular and CEP. A null type (unrecognised number) sees everything. */
export function courseVisibleToAdmissionType(types: readonly string[] | null | undefined, type: string | null): boolean {
  if (!types || types.length === 0 || type === null) return true;
  return types.includes(type);
}

/** Validates an admission types payload. Returns a de-duplicated list, or null if invalid. */
export function parseAdmissionTypes(input: unknown): AdmissionTypeId[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set<string>(ADMISSION_TYPES.map((t) => t.id));
  const out: AdmissionTypeId[] = [];
  for (const v of input) {
    if (typeof v !== "string" || !allowed.has(v)) return null;
    if (!out.includes(v as AdmissionTypeId)) out.push(v as AdmissionTypeId);
  }
  return out;
}

/** True for a well-formed reg number whose department and admission type are both recognised. */
export function isValidRegNumber(regNumber: string | null | undefined): boolean {
  return !!regNumber && REG_NUMBER_REGEX.test(regNumber) && departmentOf(regNumber) !== null && admissionTypeOf(regNumber) !== null;
}

/** The shape of a course's audience settings. Empty/missing = open to all. */
export interface CourseAudience {
  levels?: readonly number[] | null;
  departments?: readonly string[] | null;
  admissionTypes?: readonly string[] | null;
}

/** True when the course is for this student's level, department AND admission type (regular / CEP). */
export function courseVisibleToStudent(course: CourseAudience, regNumber: string | null | undefined, now: Date = new Date()): boolean {
  return (
    courseVisibleToLevel(course.levels, levelOf(regNumber, now)) &&
    courseVisibleToDepartment(course.departments, departmentOf(regNumber)) &&
    courseVisibleToAdmissionType(course.admissionTypes, admissionTypeOf(regNumber))
  );
}
