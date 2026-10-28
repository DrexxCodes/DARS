import { db } from "@/lib/firebase-admin";
import { dobIndexPath, hasBirthday } from "@/lib/birthday";

export class BirthdayError extends Error {
  constructor(public code: "NOT_FOUND" | "BANNED", message: string) {
    super(message);
  }
}

/**
 * Stores the birthday on users/{uid}.dateOfBirth and in the DOB index the NPS birthday cron reads, in one transaction.
 * Write-once: a birthday that is already on file (DARS or NPS) is never overwritten from here; edits happen in NPS.
 */
export async function saveBirthday(uid: string, dob: string): Promise<{ alreadySet: boolean }> {
  return db.runTransaction(async (tx) => {
    const userRef = db.collection("users").doc(uid);
    const u = (await tx.get(userRef)).data();
    if (!u) throw new BirthdayError("NOT_FOUND", "Account not found.");
    if (u.banned === true) throw new BirthdayError("BANNED", "This account has been suspended.");
    if (hasBirthday(u)) return { alreadySet: true };
    tx.update(userRef, { dateOfBirth: dob });
    tx.set(db.doc(dobIndexPath(dob, uid)), {
      uid,
      name: String(u.fullName ?? u.name ?? ""),
      email: String(u.email ?? ""),
      month: dob.slice(5, 7),
      day: dob.slice(8, 10),
      lastBirthdayEmailYear: null,
    });
    return { alreadySet: false };
  });
}
