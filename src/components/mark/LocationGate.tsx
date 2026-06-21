"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { MapPin, AlertTriangle } from "lucide-react";

interface LocationGateProps {
  onGranted: (coords: { lat: number; lng: number }) => void;
}

type Status = "idle" | "requesting" | "denied" | "unavailable" | "unsupported";

export default function LocationGate({ onGranted }: LocationGateProps) {
  const [status, setStatus] = useState<Status>("idle");

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onGranted({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <Card className="p-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center mx-auto">
            <MapPin className="w-8 h-8 text-brand-600 dark:text-brand-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Location Required</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              DARS confirms you&apos;re on campus before marking attendance. Please allow
              location access to continue.
            </p>
          </div>

          {status === "denied" && (
            <div className="flex items-start gap-2 text-left bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Location access was denied. Enable it in your browser&apos;s site settings, then try again.
              </span>
            </div>
          )}

          {status === "unavailable" && (
            <div className="flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Couldn&apos;t determine your location. Make sure GPS/location services are turned on, then try again.</span>
            </div>
          )}

          {status === "unsupported" && (
            <div className="flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your browser doesn&apos;t support location services. Try a different browser.</span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={requestLocation}
            loading={status === "requesting"}
            icon={<MapPin className="w-5 h-5" />}
          >
            {status === "idle" ? "Enable Location" : "Try Again"}
          </Button>
        </Card>
      </div>
    </div>
  );
}