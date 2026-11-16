// Epley drifts badly past ~12 reps (a 25-rep calf raise set projected a 174 lb 1RM),
// so higher-rep sets still count toward weight and volume PRs but not the 1RM estimate.
export const MAX_REPS_FOR_1RM = 12;

// Estimated one-rep max (Epley), or null when the set can't support an estimate:
// no weight (bodyweight), no reps, or too many reps to be reliable.
export function estimate1RM(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps >= 1) || reps > MAX_REPS_FOR_1RM) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
