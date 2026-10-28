"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useSsoOffer } from "@/hooks/useSsoOffer";
import { exchangeSso } from "@/lib/sso/client";

/** Pages that carry the inline "Continue with ..." block instead of the floating card. */
export const isSsoInlinePage = (pathname: string) => pathname === "/auth/login" || pathname === "/auth/register";

/** Offer + the "continue" action, shared by the floating card and the inline sign-in block. */
export function useSsoContinue({ enabled = true, ignoreDismissed = false } = {}) {
  const { user, loading, loginWithSso } = useAuth();
  const { offer, dismiss } = useSsoOffer(enabled && !loading && !user, ignoreDismissed);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const accept = async () => {
    if (!offer) return;
    setBusy(true);
    const res = await exchangeSso(offer.id);
    if (!res.ok) {
      toast.error(res.message);
      dismiss();
      setBusy(false);
      return;
    }
    try {
      await loginWithSso(res.token);
      toast.success(`Signed in as ${offer.firstName}`);
      if (pathname.startsWith("/auth/")) router.push("/dashboard");
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error(code === "auth/user-banned" ? "This account has been suspended." : "Couldn't sign you in. Please use your password.");
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  return { offer: user ? null : offer, busy, accept, dismiss };
}
