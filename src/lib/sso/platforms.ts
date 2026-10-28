/**
 * Cross-app sign-in registry. DARS and NPS share one Firebase project (same Auth users, same users/{uid}),
 * so a person signed in to one can be signed in to the other without typing a password again.
 * Keep this file identical in both repos apart from SELF.
 */
export type PlatformId = "nps" | "dars";

export const SELF: PlatformId = "dars";

export const PLATFORMS: Record<PlatformId, { id: PlatformId; name: string; fullName: string }> = {
  nps: { id: "nps", name: "NPS", fullName: "NAPSS Payment Suite" },
  dars: { id: "dars", name: "DARS", fullName: "Digital Attendance Recording System" },
};

export const isPlatformId = (v: unknown): v is PlatformId => typeof v === "string" && v in PLATFORMS;
export const otherPlatformIds = (): PlatformId[] => (Object.keys(PLATFORMS) as PlatformId[]).filter((id) => id !== SELF);

/** Readable list of platforms this browser is signed in to, e.g. "nps,dars". Only decides whether to ask the server; carries no secret. */
export const SSO_HINT_COOKIE = "drexx_sso_hint";
/** httpOnly, signed proof that this browser is signed in to platform `id`. */
export const ssoCookieName = (id: PlatformId) => `drexx_sso_${id}`;

export const SSO_MAX_AGE_S = 7 * 24 * 60 * 60;

/** What the "continue as ..." prompt needs. */
export interface SsoOffer {
  id: PlatformId;
  name: string;
  firstName: string;
}
