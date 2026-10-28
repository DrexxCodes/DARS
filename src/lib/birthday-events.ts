import { BIRTHDAY_EVENT } from "@/constants/birthday";

/** Opens the birthday sheet from non-React code (e.g. when an API answers BIRTHDAY_REQUIRED). */
export function openBirthdaySheet() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BIRTHDAY_EVENT));
}
