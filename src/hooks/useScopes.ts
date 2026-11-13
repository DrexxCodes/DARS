"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { resolveScopes, type ScopeKey } from "@/constants/scopes";
import { openOutOfScope } from "@/lib/scope-events";

/**
 * What the signed-in admin may do. `guard(scope)` is for click handlers: it returns true when allowed, and otherwise
 * opens the "Out of Scope" sheet and returns false. The server still enforces every scope; this just saves a round trip.
 */
export function useScopes() {
  const { profile } = useAuth();
  const isSuper = profile?.admin === true && profile.scope === "super";
  const held = useMemo(() => new Set<ScopeKey>(resolveScopes(profile)), [profile]);

  const can = useCallback((scope: ScopeKey) => isSuper || held.has(scope), [isSuper, held]);
  const guard = useCallback(
    (scope: ScopeKey) => {
      if (can(scope)) return true;
      openOutOfScope({ scope, reason: "missing" });
      return false;
    },
    [can]
  );

  return { isSuper, can, guard };
}
