"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button } from "@/components/ui";
import { resetStudentDevice } from "@/lib/device-client";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  onClose: () => void;
  student: { regNumber: string; name: string };
  onDone: () => void;
}

/** Confirms unlinking a student's phone/browser. Their next self-mark links the device they use then. */
export default function ResetDeviceSheet({ open, onClose, student, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const who = student.name || student.regNumber;
  const close = () => !busy && onClose();

  const confirm = async () => {
    setBusy(true);
    const result = await resetStudentDevice(student.regNumber);
    setBusy(false);
    if (!result.ok) {
      haptic([60, 40, 60]);
      toast.error(result.error);
      return;
    }
    haptic([30, 60, 30]);
    toast.success(`${who}'s device was reset.`);
    onClose();
    onDone();
  };

  return (
    <GlideSheet open={open} onClose={close} icon={<Smartphone className="h-5 w-5" />} title="Reset linked device?" subtitle={who}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            Do this when they changed phones, cleared their browser data, or switched between the browser and the installed app.
            The next time they mark attendance, the phone or browser they use <strong>then</strong> becomes their linked device.
          </p>
          <p className="mt-2 font-semibold">Only reset it for the student in person or someone you can verify.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} onClick={confirm}>
            Reset device
          </Button>
        </div>
      </div>
    </GlideSheet>
  );
}
