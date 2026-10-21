// Browser-only helper: always takes a FRESH GPS fix (no cached position).
export interface Fix { lat: number; lng: number; accuracy: number }

export function getFreshPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(Object.assign(new Error("unsupported"), { kind: "unsupported" }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(Object.assign(new Error(err.message), {
          kind: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

interface BestPositionOptions {
  /** Stop early as soon as a reading is this accurate (meters). */
  targetAccuracy?: number;
  /** Give up waiting for a better reading after this long (ms). */
  maxWaitMs?: number;
}

/**
 * Listens for GPS readings and resolves with the most accurate one. The first fix is usually rough and refines over
 * a few seconds, so this is used where precision matters more than speed (capturing a location tag).
 * Rejects only if permission is denied or no reading arrives at all.
 */
export function getBestPosition({ targetAccuracy = 15, maxWaitMs = 10_000 }: BestPositionOptions = {}): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(Object.assign(new Error("unsupported"), { kind: "unsupported" }));
      return;
    }

    let best: Fix | null = null;
    let done = false;
    let watchId = 0;
    let timer: ReturnType<typeof setTimeout>;

    const stop = () => {
      done = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
    };
    const finish = () => {
      if (done) return;
      stop();
      if (best) resolve(best);
      else reject(Object.assign(new Error("no reading"), { kind: "unavailable" }));
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (done) return;
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (best.accuracy <= targetAccuracy) finish();
      },
      (err) => {
        // Transient errors (timeout / unavailable) are ignored; the timer decides. Only a denial is final.
        if (done || err.code !== err.PERMISSION_DENIED) return;
        stop();
        reject(Object.assign(new Error(err.message), { kind: "denied" }));
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    timer = setTimeout(finish, maxWaitMs);
  });
}
