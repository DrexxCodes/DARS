"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Badge, Skeleton, Dialog } from "@/components/ui";
import { clientAuth } from "@/lib/firebase-client";
import { toast } from "sonner";
import {
  MapPin, Plus, Star, Trash2, Tag as TagIcon, Crosshair, AlertTriangle,
} from "lucide-react";

interface LocationTag {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isPrimary: boolean;
  createdAt: number;
}

type CaptureStatus = "idle" | "capturing" | "captured" | "denied" | "unavailable" | "unsupported";

export default function TagsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [locations, setLocations] = useState<LocationTag[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // New tag form state
  const [showForm, setShowForm] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("200");
  const [makePrimary, setMakePrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!profile || profile.scope !== "super")) router.push("/");
  }, [authLoading, profile, router]);

  const getToken = async () => clientAuth.currentUser?.getIdToken();

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/locations", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLocations(data.locations || []);
    } catch {
      toast.error("Failed to load location tags.");
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => { if (profile?.scope === "super") fetchLocations(); }, [profile, fetchLocations]);

  const resetForm = () => {
    setShowForm(false);
    setCaptureStatus("idle");
    setCoords(null);
    setName("");
    setRadius("200");
    setMakePrimary(false);
  };

  const startCapture = () => {
    setShowForm(true);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setCaptureStatus("unsupported");
      return;
    }
    setCaptureStatus("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCaptureStatus("captured");
      },
      (err) => {
        setCaptureStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleCreate = async () => {
    if (!coords) { toast.error("Location hasn't been captured yet."); return; }
    if (!name.trim()) { toast.error("Give this location a name."); return; }
    const radiusNum = Number(radius);
    if (!radiusNum || radiusNum <= 0) { toast.error("Enter a valid radius in meters."); return; }

    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          lat: coords.lat,
          lng: coords.lng,
          radiusMeters: radiusNum,
          isPrimary: makePrimary,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create tag."); return; }
      toast.success(`Location "${name.trim()}" created.`);
      resetForm();
      fetchLocations();
    } catch {
      toast.error("Failed to create tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setSettingPrimaryId(id);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, setPrimary: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to set primary."); return; }
      toast.success("Primary location updated.");
      fetchLocations();
    } catch {
      toast.error("Failed to set primary.");
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDelete = async (id: string, locName: string) => {
    setDeletingId(id);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete tag."); return; }
      toast.success(`"${locName}" deleted.`);
      fetchLocations();
    } catch {
      toast.error("Failed to delete tag.");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !profile || profile.scope !== "super") return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Location Tags</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Define the campus locations classes can be held at, and set check-in range
          </p>
        </div>
        <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={startCapture}>
          Tag
        </Button>
      </div>

      {/* Existing tags */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
          Saved Locations
        </h2>
        {loadingLocations ? (
          <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : locations.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No location tags yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    loc.isPrimary ? "bg-brand-100 dark:bg-brand-900" : "bg-slate-100 dark:bg-slate-800"
                  }`}>
                    <MapPin className={`w-4 h-4 ${loc.isPrimary ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{loc.name}</p>
                      {loc.isPrimary && <Badge variant="green">Primary</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · {loc.radiusMeters}m radius
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!loc.isPrimary && (
                    <Button
                      size="sm" variant="outline" icon={<Star className="w-3.5 h-3.5" />}
                      loading={settingPrimaryId === loc.id}
                      onClick={() => handleSetPrimary(loc.id)}
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />}
                    loading={deletingId === loc.id}
                    disabled={loc.isPrimary || locations.length === 1}
                    onClick={() => handleDelete(loc.id, loc.name)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Capturing location dialog */}
      <Dialog
        open={showForm && captureStatus === "capturing"}
        onClose={() => {}}
        title="Capturing Location"
        icon={<Crosshair className="w-5 h-5" />}
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-brand-200 dark:border-brand-900 border-t-brand-600 dark:border-t-brand-400 animate-spin" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Please hold as DARS captures your location...
          </p>
        </div>
      </Dialog>

      {/* New tag form dialog */}
      <Dialog
        open={showForm && captureStatus !== "capturing"}
        onClose={resetForm}
        title="Create Location Tag"
        icon={<TagIcon className="w-5 h-5" />}
      >
        {captureStatus === "denied" && (
          <div className="flex items-start gap-2 text-left bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Location access was denied. Enable it in your browser&apos;s site settings, then try again.</span>
          </div>
        )}
        {captureStatus === "unavailable" && (
          <div className="flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Couldn&apos;t determine your location. Make sure GPS/location services are turned on, then try again.</span>
          </div>
        )}
        {captureStatus === "unsupported" && (
          <div className="flex items-start gap-2 text-left bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Your browser doesn&apos;t support location services. Try a different browser.</span>
          </div>
        )}

        {(captureStatus === "denied" || captureStatus === "unavailable" || captureStatus === "unsupported") && (
          <Button className="w-full mb-4" variant="outline" icon={<Crosshair className="w-4 h-4" />} onClick={startCapture}>
            Try Again
          </Button>
        )}

        {captureStatus === "captured" && coords && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-mono px-3 py-2 rounded-lg">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </div>

            <Input
              label="Location Name"
              placeholder="e.g. Faculty of Social Sciences Auditorium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="So you can easily identify this location later"
              autoFocus
            />

            <Input
              label="Check-in Range (meters)"
              type="number"
              placeholder="200"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              hint="Students must be within this distance to mark attendance"
            />

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={makePrimary || locations.length === 0}
                  disabled={locations.length === 0}
                  onChange={(e) => setMakePrimary(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors flex items-center justify-center">
                  {(makePrimary || locations.length === 0) && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {locations.length === 0 ? "Set as primary location (required for the first tag)" : "Set as primary location"}
              </span>
            </label>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={resetForm}>Cancel</Button>
              <Button className="flex-1" loading={saving} onClick={handleCreate}>Create Tag</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
