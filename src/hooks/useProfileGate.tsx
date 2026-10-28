"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { BIRTHDAY_EVENT } from "@/constants/birthday";

/** What a signed-in student still owes the system before DARS lets them act. Registration number first, then birthday. */
export type GateStep = "regNumber" | "birthday";

interface GateContext {
  /** The outstanding requirement, or null when the profile is complete (or not yet confirmed by the server). */
  step: GateStep | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Call before an action: returns true when it may go ahead, otherwise opens the sheet and returns false. */
  ensure: () => boolean;
}

const Ctx = createContext<GateContext | null>(null);

const AUTO_OPEN_DELAY_MS = 700;

export function ProfileGateProvider({ children }: { children: ReactNode }) {
  const { profile, profileSynced, patchProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const autoOpenedFor = useRef<GateStep | null>(null);

  // Decided only from a profile the server has confirmed, so a stale local cache (or being offline) never nags.
  const step = useMemo<GateStep | null>(() => {
    if (!profile || !profileSynced || profile.banned) return null;
    if (!profile.regNumber) return profile.admin ? null : "regNumber"; // admins don't need a reg number
    return profile.birthdayProvided ? null : "birthday";
  }, [profile, profileSynced]);

  // The asynchronous check: as soon as the server confirms something is missing, glide the sheet up once per step.
  useEffect(() => {
    if (!step) {
      autoOpenedFor.current = null;
      setOpen(false);
      return;
    }
    if (autoOpenedFor.current === step) return;
    autoOpenedFor.current = step;
    const t = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [step]);

  // An API answered BIRTHDAY_REQUIRED: our copy of the profile was stale. Correct it and ask.
  useEffect(() => {
    const onRequired = () => {
      patchProfile({ birthdayProvided: false });
      setOpen(true);
    };
    window.addEventListener(BIRTHDAY_EVENT, onRequired);
    return () => window.removeEventListener(BIRTHDAY_EVENT, onRequired);
  }, [patchProfile]);

  const ensure = useCallback(() => {
    if (!step) return true;
    setOpen(true);
    return false;
  }, [step]);

  const value = useMemo(() => ({ step, open, setOpen, ensure }), [step, open, ensure]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfileGate(): GateContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfileGate must be used within ProfileGateProvider");
  return ctx;
}
