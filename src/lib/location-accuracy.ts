/** Accuracy bands (meters) for a captured location-tag centre. Smaller is better. */
export const ACCURACY_GOOD_M = 20;
export const ACCURACY_POOR_M = 50;

export type AccuracyTier = "good" | "fair" | "poor";

export function accuracyTier(meters: number): AccuracyTier {
  if (meters <= ACCURACY_GOOD_M) return "good";
  if (meters <= ACCURACY_POOR_M) return "fair";
  return "poor";
}
