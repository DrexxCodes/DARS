"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cake, Lock } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import DateOfBirthFields from "@/components/birthday/DateOfBirthFields";
import { checkDob, isComplete, toDobString } from "@/lib/birthday";
import { clientAuth } from "@/lib/firebase-client";
import { haptic } from "@/lib/haptics";
import type { DobParts } from "@/types/birthday";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the birthday is stored. */
  onSaved: () => void;
}

export default function BirthdaySheet({ open, onClose, onSaved }: Props) {
  const [parts, setParts] = useState<DobParts>({ day: "", month: "", year: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    const check = checkDob(toDobString(parts));
    if (!check.ok) return setError(check.message);

    setSaving(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      if (!token) return setError("Your session has expired. Please sign in again.");
      const res = await fetch("/api/profile/birthday", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dateOfBirth: check.dob }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Couldn't save your birthday. Please try again.");
      haptic([30, 60, 30]);
      toast.success("Thanks! Your birthday is saved.");
      onSaved();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlideSheet open={open} onClose={onClose} title="Just one small thing..." subtitle="When's your birthday?" icon={<Cake className="h-5 w-5" />}>
      <div className="space-y-4">
        <DateOfBirthFields value={parts} onChange={(p) => { setParts(p); setError(""); }} disabled={saving} invalid={!!error} />

        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Lock className="h-3 w-3 shrink-0" />
          For internal records only
        </p>

        {error && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

        <Button className="w-full" size="lg" onClick={save} loading={saving} disabled={!isComplete(parts)}>
          Save birthday
        </Button>
      </div>
    </GlideSheet>
  );
}
