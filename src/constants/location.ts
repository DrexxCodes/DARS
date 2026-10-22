/** Location tuning shared by the client hook and the /api/mark route. All distances are in meters. */
export const LOCATION_LIMITS = {
  /** Server accepts any fix at least this precise (unchanged from before). */
  MAX_ACCURACY_M: 150,
  /**
   * Absolute ceiling. A fix between MAX_ACCURACY_M and this is still accepted when its whole uncertainty circle
   * (distance + accuracy) sits inside the class's radius, so the student is provably in range. Anything worse is rejected.
   */
  HARD_MAX_ACCURACY_M: 500,
} as const;

export const GEO = {
  /** A reading this precise is used immediately. */
  GOOD_ACCURACY_M: 50,
  /** Matches the server's MAX_ACCURACY_M. */
  USABLE_ACCURACY_M: LOCATION_LIMITS.MAX_ACCURACY_M,
  /** Readings older than this are ignored. */
  FRESH_MS: 60_000,
  /** After the first usable reading, keep refining for this long before settling (only matters right after page load). */
  REFINE_WINDOW_MS: 3_000,
  /** No usable reading yet? Start a second, network-based (Wi-Fi/cell) watch in parallel. */
  FALLBACK_AFTER_MS: 5_000,
  /** Status flips to "unavailable" if nothing at all arrives within this long. */
  NO_SIGNAL_AFTER_MS: 20_000,
  /** How long tapping "Mark" is willing to wait for a fix before sending the best one it has. */
  TAP_MAX_WAIT_MS: 15_000,
} as const;
