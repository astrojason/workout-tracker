import type { CompletedSet, PRResult } from "./types";
import { getPR, savePR } from "./firestore";

export async function checkForPRs(
  userId: string,
  exerciseName: string,
  newSets: CompletedSet[]
): Promise<PRResult[]> {
  const prs: PRResult[] = [];
  const weightedSets = newSets.filter((s) => s.actualWeight > 0 && s.completed);
  if (weightedSets.length === 0) return prs;

  // 1. Max weight PR
  const maxWeight = Math.max(...weightedSets.map((s) => s.actualWeight));
  const prevWeight = await getPR(userId, exerciseName, "weight");
  if (prevWeight === null || maxWeight > prevWeight) {
    prs.push({
      exerciseName,
      type: "weight",
      value: maxWeight,
      previousBest: prevWeight,
    });
    await savePR(userId, exerciseName, "weight", maxWeight);
  }

  // 2. Estimated 1RM (Epley formula)
  const best1RM = Math.max(
    ...weightedSets.map((s) =>
      s.actualReps === 1 ? s.actualWeight : s.actualWeight * (1 + s.actualReps / 30)
    )
  );
  if (best1RM > 0) {
    const prev1RM = await getPR(userId, exerciseName, "estimated1RM");
    if (prev1RM === null || best1RM > prev1RM) {
      prs.push({
        exerciseName,
        type: "estimated1RM",
        value: best1RM,
        previousBest: prev1RM,
      });
      await savePR(userId, exerciseName, "estimated1RM", best1RM);
    }
  }

  // 3. Volume PR (total weight x reps)
  const totalVolume = weightedSets.reduce(
    (sum, s) => sum + s.actualWeight * s.actualReps, 0
  );
  if (totalVolume > 0) {
    const prevVolume = await getPR(userId, exerciseName, "volume");
    if (prevVolume === null || totalVolume > prevVolume) {
      prs.push({
        exerciseName,
        type: "volume",
        value: totalVolume,
        previousBest: prevVolume,
      });
      await savePR(userId, exerciseName, "volume", totalVolume);
    }
  }

  return prs;
}
