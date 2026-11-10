/** Class timing shared by the start-class sheet, the /api/classes route and the mark routes. All values are minutes. */
export const CLASS_DEFAULTS = {
  /** A class runs 2 hours unless the admin picks otherwise. */
  DURATION_MIN: 120,
  /** Same as the old fixed rule (late from 90 min in), so a class started without the new fields behaves as before. */
  LATE_AFTER_MIN: 90,
} as const;

export const CLASS_LIMITS = {
  MIN_DURATION_MIN: 5,
  MAX_DURATION_MIN: 12 * 60,
  NAME_MAX: 60,
} as const;
