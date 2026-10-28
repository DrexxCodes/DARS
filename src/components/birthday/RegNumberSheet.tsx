"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IdCard } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button, Input } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { normalizeRegNumber, validateRegNumber } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the saved registration number. */
  onSaved: (regNumber: string) => void;
}

/** For an account that arrived from NPS without a registration number: DARS can't find the student until it has one. */
export default function RegNumberSheet({ open, onClose, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const reg = normalizeRegNumber(value);
    if (!validateRegNumber(reg)) return setError("Invalid format. Expected e.g. 2023134001 or 2023174001");
    setError("");
    setSaving(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      if (!token) return setError("Your session has expired. Please sign in again.");
      const res = await fetch("/api/profile/reg-number", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ regNumber: reg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || "Couldn't save your registration number. Please try again.");
      toast.success("Registration number saved.");
      onSaved(data.regNumber ?? reg);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlideSheet open={open} onClose={onClose} title="Quick one first..." subtitle="What's your registration number?" icon={<IdCard className="h-5 w-5" />}>
      <div className="space-y-4">
        <Input
          label="Registration number"
          placeholder="e.g. 2023134001"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          error={error}
          hint="DARS uses it to find you when you mark attendance."
          inputMode="numeric"
          autoComplete="off"
          className="text-center font-mono text-lg tracking-widest"
        />
        <Button className="w-full" size="lg" onClick={save} loading={saving} disabled={!value.trim()}>
          Save
        </Button>
      </div>
    </GlideSheet>
  );
}
