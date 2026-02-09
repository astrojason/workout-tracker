"use client";

import type { ActiveSession } from "@/lib/types";
import { cleanWeight, formatDuration, isTimeBased, formatTimeValue } from "@/lib/types";

interface WorkoutCompleteProps {
  session: ActiveSession;
  onDone: () => void;
}

export function WorkoutComplete({ session, onDone }: WorkoutCompleteProps) {
  const duration = Math.round((Date.now() - session.startTime.getTime()) / 1000);
  const completedSets = session.completedSets.filter((s) => s.completed);
  const exerciseNames = [...new Set(session.completedSets.map((s) => s.exerciseName))];

  // Group sets by exercise
  const grouped: { name: string; sets: typeof session.completedSets }[] = [];
  const order: string[] = [];
  for (const set of session.completedSets) {
    if (!order.includes(set.exerciseName)) order.push(set.exerciseName);
  }
  for (const name of order) {
    grouped.push({
      name,
      sets: session.completedSets.filter((s) => s.exerciseName === name),
    });
  }

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
            <div className="text-2xl font-bold">{exerciseNames.length}</div>
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
          <div className="space-y-1">
            {grouped.map((group) => {
              const done = group.sets.filter((s) => s.completed);
              const exercise = session.workout.exercises.find((e) => e.name === group.name);
              const timeBased = exercise ? isTimeBased(exercise) : false;
              const reps = done.map((s) => timeBased ? formatTimeValue(s.actualReps) : s.actualReps).join(", ");
              const w = done[0]?.actualWeight ?? 0;
              return (
                <div key={group.name} className="flex justify-between text-sm py-1">
                  <span className="text-gray-300">{group.name}</span>
                  <span className="text-gray-500">
                    {done.length}/{group.sets.length} [{reps}]
                    {w > 0 ? ` @ ${cleanWeight(w)} lbs` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Done button */}
        <button
          onClick={onDone}
          className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-lg transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
