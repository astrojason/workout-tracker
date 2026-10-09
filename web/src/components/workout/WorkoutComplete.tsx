"use client";

import type { ReactNode } from "react";
import type { ActiveSession, CompletedSet } from "@/lib/types";
import { cleanWeight, formatDuration, formatTimeValue, isSkippedSet, setLoadLabel } from "@/lib/types";

interface ExerciseGroup {
  key: number;
  label: string;
  timeBased: boolean;
  sets: CompletedSet[];
}

// One group per exercise occurrence, not per name: a lift's warmup and working
// sets are separate rows, so the warmup weight never stands in for the working one.
function groupByOccurrence(session: ActiveSession): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  for (const set of session.completedSets) {
    let group = groups.find((g) => g.key === set.exerciseOrder);
    if (!group) {
      const exercise = session.workout.exercises.find((e) => e.order === set.exerciseOrder);
      const sameNameElsewhere = session.workout.exercises.some(
        (e) => e.name === set.exerciseName && e.order !== set.exerciseOrder,
      );
      group = {
        key: set.exerciseOrder,
        label: exercise?.phase === "warmup" && sameNameElsewhere ? `${set.exerciseName} (warmup)` : set.exerciseName,
        timeBased: exercise?.isTimeBased ?? set.isTimeBased === true,
        sets: [],
      };
      groups.push(group);
    }
    group.sets.push(set);
  }
  return groups;
}

function summaryText(group: ExerciseGroup): string {
  if (group.sets.every(isSkippedSet)) return "Skipped";
  const done = group.sets.filter((s) => s.completed);
  const reps = done.map((s) => (group.timeBased ? formatTimeValue(s.actualReps) : s.actualReps)).join(", ");
  // The heaviest set is the working weight when it moved mid-exercise (50/45/45 reads as 50).
  const top = done.reduce<CompletedSet | null>((best, s) => (!best || s.actualWeight > best.actualWeight ? s : best), null);
  const load = !top ? "" : top.actualWeight > 0 ? ` @ ${cleanWeight(top.actualWeight)} lbs` : setLoadLabel(top) === "BW" ? "" : ` · ${setLoadLabel(top)}`;
  return `${done.length}/${group.sets.length} [${reps}]${load}`;
}

interface WorkoutCompleteProps {
  session: ActiveSession;
  onDone: () => void;
  isSaving?: boolean;
  saveError?: string | null;
  onRetrySave?: () => void;
  coachSlot?: ReactNode; // shown once the session is saved, so the coach sees persisted results
}

export function WorkoutComplete({ session, onDone, isSaving, saveError, onRetrySave, coachSlot }: WorkoutCompleteProps) {
  const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);
  const completedSets = session.completedSets.filter((s) => s.completed);
  const grouped = groupByOccurrence(session);
  const exerciseCount = new Set(session.completedSets.map((s) => s.exerciseName)).size;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-lg mx-auto">
        {/* Celebration */}
        <div className="text-center py-8">
          <div className="text-6xl mb-4">&#x2705;</div>
          <h1 className="text-3xl font-bold mb-2">Workout Complete!</h1>
          <p className="text-gray-400">
            {session.workout.programName} - {session.workout.dayOfWeek}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
            <div className="text-2xl font-bold">{formatDuration(duration)}</div>
            <div className="text-xs text-gray-400">Duration</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
            <div className="text-2xl font-bold">{completedSets.length}</div>
            <div className="text-xs text-gray-400">Sets</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
            <div className="text-2xl font-bold">{exerciseCount}</div>
            <div className="text-xs text-gray-400">Exercises</div>
          </div>
        </div>

        {/* PRs */}
        {session.prsAchieved.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-yellow-400 mb-3">
              &#x1F3C6; Personal Records!
            </h2>
            <div className="space-y-2">
              {session.prsAchieved.map((pr, i) => (
                <div key={i} className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{pr.exerciseName}</div>
                    <div className="text-sm text-gray-400">
                      {pr.type}: {cleanWeight(pr.value)}
                    </div>
                  </div>
                  {pr.previousBest ? (
                    <span className="text-xs text-gray-500">was {cleanWeight(pr.previousBest)}</span>
                  ) : (
                    <span className="text-xs text-green-400 font-bold">First!</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mb-6">
          <h2 className="font-bold mb-3">Summary</h2>
          <div className="space-y-1" data-testid="summary">
            {grouped.map((group) => (
              <div key={group.key} data-label={group.label} className="flex justify-between text-sm py-1">
                <span className="text-gray-300">{group.label}</span>
                <span className="text-gray-500">{summaryText(group)}</span>
              </div>
            ))}
          </div>
        </div>

        {!isSaving && !saveError && coachSlot}

        {/* View details link */}
        <div className="mb-4 text-center">
          <a href="#session-details" className="text-indigo-400 text-sm hover:text-indigo-300 transition">
            View Details
          </a>
        </div>

        {/* Done button / Save status */}
        {saveError ? (
          <div>
            <p className="text-red-400 text-sm text-center mb-3">{saveError}</p>
            <div className="flex gap-3">
              <button
                onClick={onRetrySave}
                className="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-lg transition"
              >
                Retry Save
              </button>
              <button
                onClick={onDone}
                className="flex-1 py-4 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-lg transition text-gray-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : isSaving ? (
          <button disabled className="w-full py-4 rounded-xl bg-gray-700 font-bold text-lg opacity-60 cursor-not-allowed">
            Saving...
          </button>
        ) : (
          <button
            onClick={onDone}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-lg transition"
          >
            Done
          </button>
        )}

        {/* Session details table */}
        <div id="session-details" className="mt-6">
          <h2 className="font-bold mb-3">Set Details</h2>
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.key} data-testid={`set-details-${group.label}`}>
                <h3 className="text-sm font-semibold text-gray-300 mb-1">{group.label}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="py-2 text-left">Set</th>
                      <th className="py-2 text-right">Weight</th>
                      <th className="py-2 text-right">{group.timeBased ? "Time" : "Reps"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {group.sets.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 text-gray-400">{s.setNumber}</td>
                        {isSkippedSet(s) ? (
                          <td colSpan={2} className="py-2 text-right text-gray-500">Skipped</td>
                        ) : (
                          <>
                            <td className="py-2 text-right font-mono">{setLoadLabel(s)}</td>
                            <td className="py-2 text-right font-mono">
                              {group.timeBased ? formatTimeValue(s.actualReps) : s.actualReps}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
