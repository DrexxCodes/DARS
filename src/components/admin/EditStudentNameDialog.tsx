"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the saved name so the parent can update what it shows. */
  onSaved: (name: string) => void;
  student: { regNumber: string; name: string };
}

export default function EditStudentNameDialog({ open, onClose, onSaved, student }: Props) {
  const [name, setName] = useState(student.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(student.name);
  }, [open, student.name]);

  const cleaned = name.replace(/\s+/g, " ").trim();
  const unchanged = cleaned === student.name;

  const save = async () => {
    if (cleaned.length < 2) {
      toast.error("Enter the student's full name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/students/${student.regNumber}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await clientAuth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({ name: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't update the name.");
        return;
      }
      toast.success("Name updated.");
      onSaved(data.name ?? cleaned);
      onClose();
    } catch {
      toast.error("Couldn't update the name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit Student Name" icon={<Pencil className="w-5 h-5" />}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{student.regNumber}</p>
        <Input
          label="Full name"
          value={name}
          maxLength={100}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !unchanged && save()}
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={saving} disabled={unchanged || cleaned.length < 2} onClick={save}>Save</Button>
        </div>
      </div>
    </Dialog>
  );
}
