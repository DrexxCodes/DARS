"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { clientAuth } from "@/lib/firebase-client";

/** Sets an admin's "leave me out of attendance exports" flag. Omit `uid` for your own; super admins can pass another admin's uid. */
export function useExportVisibility() {
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const setExcluded = useCallback(async (exclude: boolean, uid?: string): Promise<boolean> => {
    setBusyUid(uid ?? "self");
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/export-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ exclude, ...(uid ? { uid } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't update the setting.");
        return false;
      }
      toast.success(exclude ? "Hidden from attendance exports." : "Will appear in attendance exports.");
      return true;
    } catch {
      toast.error("Couldn't update the setting.");
      return false;
    } finally {
      setBusyUid(null);
    }
  }, []);

  return { setExcluded, busyUid };
}
