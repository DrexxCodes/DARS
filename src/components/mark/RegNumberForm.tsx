"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { validateRegNumber, normalizeRegNumber } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface RegNumberFormProps {
  courseId: string;
  courseName: string;
  lat: number;
  lng: number;
  onSuccess: (result: { name: string; late: boolean; timestamp: number }) => void;
  onNotFound: () => void;
}

export default function RegNumberForm({ courseId, courseName, lat, lng, onSuccess, onNotFound }: RegNumberFormProps) {
  const [regNumber, setRegNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const normalized = normalizeRegNumber(regNumber);

    if (!validateRegNumber(normalized)) {
      setError("Invalid format. Expected e.g. 2023133001 or 2022134005");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regNumber: normalized, courseId, lat, lng }),
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
      setRegNumber("");
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
      </div>

      <Input
        label="Registration Number"
        placeholder="e.g. 2023133001"
        value={regNumber}
        onChange={(e) => {
          setRegNumber(e.target.value);
          setError("");
        }}
        error={error}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        hint="Format: 20YY133XXX or 20YY134XXX"
        autoFocus
        className="font-mono text-center tracking-widest text-lg"
      />

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        loading={loading}
        icon={<CheckCircle2 className="w-5 h-5" />}
      >
        Mark Attendance
      </Button>
    </div>
  );
}