/** Signals the client sends with every self-mark so the server can detect one device signing for several people. */
export interface DeviceSignals {
  /** SHA-256 of stable hardware/browser traits. Survives incognito, but identical phone models share one. */
  fingerprint: string;
  /** Random ID kept in localStorage. Unique per browser profile, so it separates identical phone models. Resets in incognito. */
  deviceId: string;
}
