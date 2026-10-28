"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { ProfileGateProvider, useProfileGate } from "@/hooks/useProfileGate";
import BirthdaySheet from "@/components/birthday/BirthdaySheet";
import RegNumberSheet from "@/components/birthday/RegNumberSheet";
import GateInterceptor from "@/components/gate/GateInterceptor";

function GateSheets() {
  const { patchProfile } = useAuth();
  const { step, open, setOpen } = useProfileGate();
  const close = () => setOpen(false);
  return (
    <>
      <RegNumberSheet open={open && step === "regNumber"} onClose={close} onSaved={(regNumber) => patchProfile({ regNumber })} />
      <BirthdaySheet open={open && step === "birthday"} onClose={close} onSaved={() => patchProfile({ birthdayProvided: true })} />
    </>
  );
}

/** Mount once inside AuthProvider. Asks for whatever the signed-in student is missing and blocks actions until they answer. */
export default function ProfileGate({ children }: { children: ReactNode }) {
  return (
    <ProfileGateProvider>
      {children}
      <GateSheets />
      <GateInterceptor />
    </ProfileGateProvider>
  );
}
