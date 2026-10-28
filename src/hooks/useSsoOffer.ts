"use client";

import { useCallback, useEffect, useState } from "react";
import { SELF, type SsoOffer } from "@/lib/sso/platforms";
import { dismissSso, isSsoDismissed, peekSso, readSsoHint } from "@/lib/sso/client";

/**
 * Is this browser signed in to the other platform? The readable hint cookie answers that instantly, so nobody
 * pays for a server call unless there is actually something to offer.
 */
export function useSsoOffer(enabled: boolean, /** Sign-in pages: show it even after a "Not now" or a sign-out. */ ignoreDismissed = false) {
  const [offer, setOffer] = useState<SsoOffer | null>(null);

  useEffect(() => {
    if (!enabled || (!ignoreDismissed && isSsoDismissed()) || !readSsoHint().some((id) => id !== SELF)) {
      setOffer(null);
      return;
    }
    let alive = true;
    void peekSso().then((o) => alive && setOffer(o));
    return () => { alive = false; };
  }, [enabled, ignoreDismissed]);

  const dismiss = useCallback(() => {
    if (!ignoreDismissed) dismissSso(); // on sign-in pages "Not now" only hides it for this visit
    setOffer(null);
  }, [ignoreDismissed]);

  return { offer, dismiss };
}
