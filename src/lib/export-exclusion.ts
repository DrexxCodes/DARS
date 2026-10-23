import { db } from "@/lib/firebase-admin";

/**
 * Registration numbers of admins who chose to be left out of attendance exports (users.excludeFromExports === true).
 * One equality query on `admin` (no composite index needed); the admin list is tiny so the flag is filtered in memory.
 */
export async function excludedRegNumbers(): Promise<Set<string>> {
  const snap = await db.collection("users").where("admin", "==", true).select("regNumber", "excludeFromExports").get();
  const out = new Set<string>();
  for (const d of snap.docs) {
    const { regNumber, excludeFromExports } = d.data();
    if (excludeFromExports === true && typeof regNumber === "string" && regNumber) out.add(regNumber.toUpperCase());
  }
  return out;
}
