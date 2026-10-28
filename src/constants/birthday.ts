/** Age window for a student's date of birth. Mirrors NPS (src/lib/validation/schemas.ts) so both apps accept the same dates. */
export const MIN_AGE_YEARS = 14;
export const MAX_AGE_YEARS = 80;

/** Error code the API returns when an action needs a birthday on file. The client answers it by opening the sheet. */
export const BIRTHDAY_REQUIRED_CODE = "BIRTHDAY_REQUIRED";
/** Window event that opens the birthday sheet from anywhere (a failed API call, for example). */
export const BIRTHDAY_EVENT = "dars:open-birthday-sheet";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
