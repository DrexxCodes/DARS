"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { validateRegNumber, normalizeRegNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { clientAuth } from "@/lib/firebase-client";
import { CheckCircle2, UserCog } from "lucide-react";

interface MarkButtonProps {
  courseId: string;
  courseName: string;
  lat: number;
  lng: number;
  onSuccess: (result: { name: string; late: boolean; timestamp: number }) => void;
  onNotFound: () => void;
}

export default function MarkButton({ courseId, courseName, lat, lng, onSuccess, onNotFound }: MarkButtonProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.admin === true;

  const [overrideReg, setOverrideReg] = useState("");
  const [useOverride, setUseOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleMark = async () => {
    setError("");

    let regNumber: string | undefined;
    if (isAdmin && useOverride) {
      const normalized = normalizeRegNumber(overrideReg);
      if (!validateRegNumber(normalized)) {
        setError("Invalid format. Expected e.g. 2023133001 or 2022134005");
        return;
      }
      regNumber = normalized;
    }

    setLoading(true);
    try {
      const token = await clientAuth.currentUser?.getIdToken();
      const res = await fetch("/api/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ courseId, lat, lng, ...(regNumber ? { regNumber } : {}) }),
      });

      const data = await res.json();

      if (res.status === 404 && data.code === "NOT_FOUND") {
        onNotFound();
        return;
      }

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      onSuccess({ name: data.name, late: data.late, timestamp: data.timestamp });
      setOverrideReg("");
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
              hint="Format: 20YY133XXX or 20YY134XXX"
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
    </div>
  );
}
