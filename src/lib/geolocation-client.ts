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
