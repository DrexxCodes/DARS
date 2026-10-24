"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { validateRegNumber, normalizeRegNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { clientAuth } from "@/lib/firebase-client";
import type { LocationApi, GeoErrorKind } from "@/hooks/useLocationFix";
import { getDeviceSignals } from "@/lib/device-fingerprint";
import { haptic } from "@/lib/haptics";
import { CheckCircle2, UserCog } from "lucide-react";

interface MarkButtonProps {
  courseId: string;
  courseName: string;
  location: Pick<LocationApi, "waitForFix" | "retry">;
  onSuccess: (result: { name: string; late: boolean; timestamp: number }) => void;
  onNotFound: () => void;
}

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 20_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function geoMessage(kind?: GeoErrorKind): string {
  switch (kind) {
    case "denied":
      return "Location access was denied. Enable it in your phone or browser's site settings and try again.";
    case "weak":
      return "Your GPS signal is too weak right now. Move near a window or step outside for a few seconds, then tap again.";
    case "unsupported":
      return "Your browser doesn't support location services. Try a different browser.";
    default:
      return "Couldn't get your location. Turn on Location (High accuracy) on your phone and try again.";
  }
}

export default function MarkButton({ courseId, courseName, location, onSuccess, onNotFound }: MarkButtonProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.admin === true;

  const [overrideReg, setOverrideReg] = useState("");
  const [useOverride, setUseOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"locating" | "sending">("locating");

  // Compute the fingerprint ahead of time so tapping "Mark" never waits on it
  useEffect(() => {
    getDeviceSignals().catch(() => {});
  }, []);

  const handleMark = async () => {
    setError("");
    haptic(8); // instant tap feedback (also satisfies iOS's need for a direct tap)

    let regNumber: string | undefined;
    if (isAdmin && useOverride) {
      const normalized = normalizeRegNumber(overrideReg);
      if (!validateRegNumber(normalized)) {
        setError("Invalid format. Expected e.g. 2023134001 or 2023174001");
        return;
      }
      regNumber = normalized;
    }

    setLoading(true);
    setPhase("locating");
    try {
      // Device signals + auth token are prepared while the location fix settles, so nothing waits on them afterwards.
      const signalsP = getDeviceSignals().catch(() => null);
      const tokenP = clientAuth.currentUser?.getIdToken().catch(() => undefined);

      // The live watch from the page usually has a precise fix ready already, so this is normally instant.
      let fix;
      try {
        fix = await location.waitForFix();
      } catch (e) {
        setError(geoMessage((e as { kind?: GeoErrorKind }).kind));
        return;
      }

      const [signals, token] = await Promise.all([signalsP, tokenP]);
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      setPhase("sending");
      const body = JSON.stringify({
        courseId,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        ...(signals ?? {}),
        ...(regNumber ? { regNumber } : {}),
      });

      // Campus networks drop requests. Retry network failures / gateway errors; the server is idempotent
      // (create() + duplicate check), so a retry after a lost response can't double-mark.
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch("/api/mark", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body,
            signal: controller.signal,
          });
        } catch {
          clearTimeout(timeout);
          if (attempt < MAX_RETRIES) {
            await sleep(700 * (attempt + 1));
            continue;
          }
          setError("Network error. Please check your connection.");
          return;
        }
        clearTimeout(timeout);

        if (res.status >= 502 && res.status <= 504 && attempt < MAX_RETRIES) {
          await sleep(700 * (attempt + 1));
          continue;
        }

        const data = await res.json().catch(() => ({}));

        // The first attempt actually went through but its response was lost: treat the duplicate as success.
        if (res.status === 409 && data.code === "DUPLICATE" && attempt > 0 && data.name) {
          haptic([30, 60, 30]);
          onSuccess({ name: data.name, late: !!data.late, timestamp: data.timestamp });
          setOverrideReg("");
          return;
        }

        if (res.status === 404 && data.code === "NOT_FOUND") {
          onNotFound();
          return;
        }

        if (!res.ok) {
          haptic([60, 40, 60]);
          setError(data.error || "Something went wrong. Please try again.");
          if (data.code === "LOW_ACCURACY") location.retry(); // start a fresh, precise reading for the next tap
          return;
        }

        haptic([30, 60, 30]);
        onSuccess({ name: data.name, late: data.late, timestamp: data.timestamp });
        setOverrideReg("");
        return;
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Marking attendance for
        </p>
        <p className="font-semibold text-slate-900 dark:text-white">{courseName}</p>
        {!useOverride && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">
            {profile?.regNumber || profile?.name}
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { setUseOverride(!useOverride); setError(""); }}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline mx-auto"
          >
            <UserCog className="w-3.5 h-3.5" />
            {useOverride ? "Mark for myself instead" : "Mark for another student"}
          </button>

          {useOverride && (
            <Input
              label="Student Registration Number"
              placeholder="e.g. 2023133001"
              value={overrideReg}
              onChange={(e) => { setOverrideReg(e.target.value); setError(""); }}
              error={error}
              onKeyDown={(e) => e.key === "Enter" && handleMark()}
              hint="Format: 20YY133XXX, 20YY134XXX, 20YY173XXX or 20YY174XXX"
              autoFocus
              className="font-mono text-center tracking-widest text-lg"
            />
          )}
        </div>
      )}

      {error && !useOverride && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleMark}
        loading={loading}
        icon={<CheckCircle2 className="w-5 h-5" />}
      >
        Mark Attendance
      </Button>
      {loading && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center -mt-2" role="status">
          {phase === "locating" ? "Getting a precise location…" : "Marking your attendance…"}
        </p>
      )}
    </div>
  );
}
