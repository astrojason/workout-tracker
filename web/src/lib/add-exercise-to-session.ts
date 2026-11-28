import type { CompletedSet, PRResult } from "./types";
import { appendSessionSets } from "./firestore";
import { checkForPRs } from "./pr-detector";

// Saves an exercise added to an already-logged session and checks its sets against the stored
// personal records, the same check a finished workout runs, so a later workout doesn't announce
// a "PR" that was already beaten here. Program weights and progression are deliberately left
// alone: they change only when a workout is finished, and the session's progressionChanges
// (which deleting it undoes) stay an exact record of what it changed.
export async function addExerciseAfterTheFact(userId: string, sessionId: string, sets: CompletedSet[]): Promise<PRResult[]> {
  if (sets.length === 0) throw new Error("No sets to add");
  await appendSessionSets(userId, sessionId, sets);
  return checkForPRs(userId, sets[0].exerciseName, sets);
}
