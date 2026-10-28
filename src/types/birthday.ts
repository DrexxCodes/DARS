/** The three picker values. Empty string = not chosen yet. */
export interface DobParts {
  day: string;
  month: string;
  year: string;
}

export type DobCheck = { ok: true; dob: string } | { ok: false; message: string };
