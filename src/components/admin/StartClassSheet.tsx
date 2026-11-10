"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";
import GlideSheet from "@/components/ui/GlideSheet";
import { Button, Input, Select } from "@/components/ui";
import DurationField from "@/components/admin/DurationField";
import { CLASS_DEFAULTS, CLASS_LIMITS } from "@/constants/class";
import { cleanClassName, formatMinutes, parseClassTiming, toMinutes, type TimeUnit } from "@/lib/class-timing";

export interface StartClassValues {
  name: string;
  locationId: string;
  durationMinutes: number;
  lateAfterMinutes: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  course: { code: string; name: string } | null;
  locations: { id: string; name: string; isPrimary: boolean }[];
  defaultLocationId: string;
  /** Pre-filled class name (admins can overwrite it). */
  suggestedName: string;
  starting: boolean;
  onStart: (values: StartClassValues) => void;
}

const asInput = (n: number) => String(Math.round(n * 100) / 100);

/** Bottom sheet shown when an admin taps Start Class: name, location, how long it runs, and when marking turns "late". */
export default function StartClassSheet({ open, onClose, course, locations, defaultLocationId, suggestedName, starting, onStart }: Props) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [duration, setDuration] = useState(asInput(CLASS_DEFAULTS.DURATION_MIN / 60));
  const [durationUnit, setDurationUnit] = useState<TimeUnit>("hr");
  const [lateAfter, setLateAfter] = useState(String(CLASS_DEFAULTS.LATE_AFTER_MIN));
  const [lateUnit, setLateUnit] = useState<TimeUnit>("min");

  // Fresh form (2 hours, late after 90 min) every time the sheet opens. Keyed on `open` only, so a background
  // refresh of the class list can't wipe what the admin is typing.
  useEffect(() => {
    if (!open) return;
    setName(suggestedName);
    setLocationId(defaultLocationId);
    setDuration(asInput(CLASS_DEFAULTS.DURATION_MIN / 60));
    setDurationUnit("hr");
    setLateAfter(String(CLASS_DEFAULTS.LATE_AFTER_MIN));
    setLateUnit("min");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const durationMinutes = toMinutes(Number(duration), durationUnit);
  const lateAfterMinutes = toMinutes(Number(lateAfter), lateUnit);

  const timing = useMemo(() => parseClassTiming(durationMinutes, lateAfterMinutes), [durationMinutes, lateAfterMinutes]);
  const cleanName = cleanClassName(name);

  // Point each message at the field it belongs to
  const durationError = !timing.ok && /duration|at least \d+ minutes|at most/i.test(timing.error) ? timing.error : undefined;
  const lateError = !timing.ok && !durationError ? timing.error : undefined;

  const canStart = !!course && !!locationId && !!cleanName && timing.ok && !starting;
  const close = () => !starting && onClose();

  return (
    <GlideSheet
      open={open}
      onClose={close}
      icon={<PlayCircle className="h-5 w-5" />}
      title="Start a class"
      subtitle={course ? `${course.code} · ${course.name}` : undefined}
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Input
          label="Class name"
          placeholder="e.g. Week 3 · Federalism"
          value={name}
          maxLength={CLASS_LIMITS.NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          disabled={starting}
        />

        <Select
          label="Location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={starting}
          options={locations.map((l) => ({ value: l.id, label: l.isPrimary ? `${l.name} (Primary)` : l.name }))}
        />

        <DurationField
          label="Class duration"
          hint="Check-in closes when this runs out."
          value={duration}
          unit={durationUnit}
          onValueChange={setDuration}
          onUnitChange={(u) => {
            // Keep the same length when the pill flips, so 2 hr becomes 120 min instead of "2 min"
            const mins = toMinutes(Number(duration), durationUnit);
            if (Number.isFinite(mins) && mins > 0) setDuration(asInput(u === "hr" ? mins / 60 : mins));
            setDurationUnit(u);
          }}
          error={durationError}
          disabled={starting}
        />

        <DurationField
          label="Mark students late after"
          hint={
            timing.ok
              ? timing.lateAfterMinutes === timing.durationMinutes
                ? "Nobody will be marked late."
                : `Students who mark ${formatMinutes(timing.lateAfterMinutes)} or more after the class starts are marked late.`
              : undefined
          }
          value={lateAfter}
          unit={lateUnit}
          onValueChange={setLateAfter}
          onUnitChange={(u) => {
            const mins = toMinutes(Number(lateAfter), lateUnit);
            if (Number.isFinite(mins) && mins > 0) setLateAfter(asInput(u === "hr" ? mins / 60 : mins));
            setLateUnit(u);
          }}
          error={lateError}
          disabled={starting}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={close} disabled={starting}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          icon={<PlayCircle className="h-4 w-4" />}
          loading={starting}
          disabled={!canStart}
          onClick={() => timing.ok && onStart({ name: cleanName, locationId, durationMinutes: timing.durationMinutes, lateAfterMinutes: timing.lateAfterMinutes })}
        >
          Start class
        </Button>
      </div>
    </GlideSheet>
  );
}
