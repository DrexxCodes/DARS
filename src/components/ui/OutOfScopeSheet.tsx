"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import { outOfScopeMessage } from "@/constants/scopes";
import { scopeDef } from "@/constants/scopes";
import { onOutOfScope, type OutOfScopeDetail } from "@/lib/scope-events";
import { haptic } from "@/lib/haptics";

/** Mounted once in the root layout. Opens whenever an admin reaches for something beyond their scope. */
export default function OutOfScopeSheet() {
  const [detail, setDetail] = useState<OutOfScopeDetail | null>(null);

  useEffect(
    () =>
      onOutOfScope((d) => {
        haptic([60, 40, 60]);
        setDetail(d);
      }),
    []
  );

  const def = detail ? scopeDef(detail.scope) : undefined;

  return (
    <GlideSheet open={!!detail} onClose={() => setDetail(null)} tone="warning" icon={<ShieldAlert className="h-5 w-5" />} title="Out of Scope">
      {detail && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{detail.message ?? outOfScopeMessage(detail.scope)}</p>
          <div className="rounded-2xl bg-amber-50 p-4 text-sm dark:bg-amber-950/40">
            <p className="font-mono text-xs font-semibold text-amber-800 dark:text-amber-200">{detail.scope}</p>
            {def && <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">{def.label}: {def.description}</p>}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ask a super admin to grant this scope or raise its limit.</p>
          <Button className="w-full" onClick={() => setDetail(null)}>
            Got it
          </Button>
        </div>
      )}
    </GlideSheet>
  );
}
