"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GEO, LOCATION_LIMITS } from "@/constants/location";
import type { Fix } from "@/lib/geolocation-client";

export type LocationStatus = "idle" | "locating" | "ready" | "weak" | "denied" | "unavailable" | "unsupported";
export type GeoErrorKind = "denied" | "unavailable" | "unsupported" | "weak";

interface Reading extends Fix { at: number }

const geoError = (kind: GeoErrorKind) => Object.assign(new Error(kind), { kind });

/**
 * Keeps a live GPS watch running while the student is on the mark page, so a precise fix is already waiting
 * when they tap "Mark Attendance".
 *
 * Why not one getCurrentPosition() call: that returns the FIRST fix (often 200 m+ off indoors) or times out on a
 * cold GPS. This hook instead:
 *   1. watches with high accuracy and keeps the most accurate fresh reading,
 *   2. adds a network-based (Wi-Fi/cell) watch if GPS hasn't produced a usable reading after a few seconds,
 *   3. never throws away a good reading: waitForFix() returns instantly when one exists.
 */
export function useLocationFix(enabled: boolean) {
  const [status, setStatusState] = useState<LocationStatus>("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const statusRef = useRef<LocationStatus>("idle");
  const readings = useRef<Reading[]>([]);
  const watchIds = useRef<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const waiters = useRef<Set<() => void>>(new Set());
  const firstUsableAt = useRef(0);

  const setStatus = useCallback((s: LocationStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const best = useCallback((): Reading | null => {
    const cutoff = Date.now() - GEO.FRESH_MS;
    readings.current = readings.current.filter((r) => r.at >= cutoff);
    let top: Reading | null = null;
    for (const r of readings.current) if (!top || r.accuracy < top.accuracy) top = r;
    return top;
  }, []);

  const notify = useCallback(() => waiters.current.forEach((fn) => fn()), []);

  const stop = useCallback(() => {
    watchIds.current.forEach((id) => navigator.geolocation?.clearWatch(id));
    watchIds.current = [];
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const start = useCallback(() => {
    stop();
    readings.current = [];
    firstUsableAt.current = 0;
    setAccuracy(null);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      notify();
      return;
    }
    setStatus("locating");

    const onFix = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
      if (!Number.isFinite(acc)) return;
      readings.current.push({ lat, lng, accuracy: acc, at: Date.now() });
      const top = best();
      if (!top) return;
      setAccuracy(Math.round(top.accuracy));
      if (top.accuracy <= GEO.USABLE_ACCURACY_M) {
        if (!firstUsableAt.current) firstUsableAt.current = Date.now();
        setStatus("ready");
      } else {
        setStatus("weak");
      }
      notify();
    };

    const onError = (err: GeolocationPositionError) => {
      // Timeouts / "unavailable" are transient for a watch; only a denial is final.
      if (err.code !== err.PERMISSION_DENIED) return;
      stop();
      setStatus("denied");
      notify();
    };

    watchIds.current.push(
      navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 0 })
    );

    // Indoors GPS can take a long time (or never lock). Wi-Fi/cell positioning answers in seconds.
    timers.current.push(
      setTimeout(() => {
        const top = best();
        if (!top || top.accuracy > GEO.USABLE_ACCURACY_M) {
          watchIds.current.push(
            navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: false, maximumAge: 30_000 })
          );
        }
      }, GEO.FALLBACK_AFTER_MS)
    );

    // Nothing at all after a long wait: tell the student instead of spinning forever (watches keep running).
    timers.current.push(
      setTimeout(() => {
        if (!best() && statusRef.current === "locating") {
          setStatus("unavailable");
          notify();
        }
      }, GEO.NO_SIGNAL_AFTER_MS)
    );
  }, [best, notify, setStatus, stop]);

  useEffect(() => {
    if (!enabled) return;
    start();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Browsers pause GPS in the background; if our readings went stale meanwhile, start fresh.
      if (statusRef.current !== "denied" && statusRef.current !== "unsupported" && !best()) start();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, [enabled, start, stop, best]);

  /**
   * Resolves with the best fresh fix as soon as it's good enough:
   *  - ≤ GOOD accuracy: immediately
   *  - ≤ USABLE accuracy: once it has had REFINE_WINDOW_MS to improve (instant if the watch has been running a while)
   *  - worse / none: waits up to TAP_MAX_WAIT_MS, then returns the best it has and lets the server judge (it accepts a
   *    weak fix when the whole uncertainty circle is inside the class radius).
   * Rejects with kind "denied" | "unsupported" | "unavailable" | "weak".
   */
  const waitForFix = useCallback(
    () =>
      new Promise<Fix>((resolve, reject) => {
        if (statusRef.current === "unsupported") return reject(geoError("unsupported"));
        if (statusRef.current === "denied") return reject(geoError("denied"));
        if (statusRef.current === "idle" || statusRef.current === "unavailable") start(); // inside a tap: also a user gesture

        const t0 = Date.now();
        let settled = false;
        let poll: ReturnType<typeof setInterval>;

        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearInterval(poll);
          waiters.current.delete(check);
          fn();
        };

        function check() {
          if (settled) return;
          if (statusRef.current === "denied") return settle(() => reject(geoError("denied")));
          if (statusRef.current === "unsupported") return settle(() => reject(geoError("unsupported")));

          const now = Date.now();
          const top = best();
          if (top) {
            const { lat, lng, accuracy: acc } = top;
            const fix = { lat, lng, accuracy: acc };
            if (acc <= GEO.GOOD_ACCURACY_M) return settle(() => resolve(fix));
            if (acc <= GEO.USABLE_ACCURACY_M && firstUsableAt.current && now - firstUsableAt.current >= GEO.REFINE_WINDOW_MS) {
              return settle(() => resolve(fix));
            }
          }
          if (now - t0 >= GEO.TAP_MAX_WAIT_MS) {
            if (!top) return settle(() => reject(geoError("unavailable")));
            if (top.accuracy > LOCATION_LIMITS.HARD_MAX_ACCURACY_M) return settle(() => reject(geoError("weak")));
            return settle(() => resolve({ lat: top.lat, lng: top.lng, accuracy: top.accuracy }));
          }
        }

        waiters.current.add(check);
        poll = setInterval(check, 250);
        check();
      }),
    [best, start]
  );

  return { status, accuracy, retry: start, waitForFix };
}

export type LocationApi = ReturnType<typeof useLocationFix>;
