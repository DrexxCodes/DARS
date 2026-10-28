"use client";

import { useEffect } from "react";
import { useProfileGate } from "@/hooks/useProfileGate";

const INTERACTIVE = "button, a[href], [role='button'], input, select, textarea, summary, label";

/**
 * While a requirement is outstanding and its sheet is closed, any tap on something interactive reopens the sheet
 * instead of doing its job ("any action will trigger it till they do it"). Runs in the capture phase, ahead of React.
 * Mark anything that must keep working (sign out, theme) with data-gate-exempt.
 */
export default function GateInterceptor() {
  const { step, open, setOpen } = useProfileGate();

  useEffect(() => {
    if (!step || open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest("[data-gate-exempt], [data-gate-sheet]")) return;
      if (!target.closest(INTERACTIVE)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, open, setOpen]);

  return null;
}
