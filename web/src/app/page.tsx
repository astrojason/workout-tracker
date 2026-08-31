"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { useWorkout } from "@/hooks/useWorkout";
import { useEquipmentConfig } from "@/hooks/useEquipmentConfig";
import { useExerciseDefinitions } from "@/hooks/useExerciseDefinitions";
import { ProgramCard } from "@/components/home/ProgramCard";
import { ConsistencyCard } from "@/components/home/ConsistencyCard";
import { ActiveWorkout } from "@/components/workout/ActiveWorkout";
import { WorkoutComplete } from "@/components/workout/WorkoutComplete";
import { ChecklistWorkout } from "@/components/workout/ChecklistWorkout";
import { isChecklistWorkout, resolveWorkout } from "@/lib/types";
import type { ResolvedWorkout, Workout } from "@/lib/types";
import { BottomNav } from "@/components/ui/BottomNav";
import { useError } from "@/components/providers/ErrorProvider";
import { useHistory } from "@/hooks/useHistory";
import { calculateWorkoutConsistency } from "@/lib/workout-consistency";

export default function HomePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { activePrograms, settings, loading, getTodaysWorkout, getAvailableDays, getCompletedDaysForProgram, currentWeek, refreshCompletedDays, getWorkoutsForDay } = usePrograms(user?.uid ?? null);
  const workout = useWorkout(user?.uid ?? null);
  const { config: equipmentConfig } = useEquipmentConfig(user?.uid ?? null);
  const { definitions, reload: reloadDefinitions } = useExerciseDefinitions(user?.uid ?? null);
  const { sessions, loading: historyLoading } = useHistory(user?.uid ?? null);
  const [checklistWorkout, setChecklistWorkout] = useState<ResolvedWorkout | null>(null);
  const { showError } = useError();

  // Resolves before committing to checklistWorkout state, so a stale/incomplete
  // definitions map (see the effect above) surfaces via the error modal instead
  // of throwing straight out of render the moment this screen mounts.
  function startChecklistWorkout(w: Workout): boolean {
    try {
      setChecklistWorkout(resolveWorkout(w, definitions));
      return true;
    } catch (err) {
      showError(err);
      return false;
    }
  }

  // usePrograms() and useExerciseDefinitions() fetch independently and in parallel.
  // On a user's first load after the exercise-library migration ships, the
  // definitions read can resolve (with stale/empty data) before usePrograms
  // finishes running the one-time migration that creates those very definitions.
  // Re-fetch once usePrograms settles so definitions reflects the post-migration
  // state before anything tries to resolve a workout against it.
  useEffect(() => {
    if (!loading) reloadDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Active workout — show regardless of auth so a session restored from localStorage
  // is never blocked by the sign-in screen.
  if (workout.session) {
    const lastExercise = workout.session.workout.exercises[workout.session.workout.exercises.length - 1];
    const lastExerciseSets = workout.session.completedSets.filter(s => s.exerciseOrder === lastExercise?.order).length;
    const workoutDone = lastExerciseSets >= (lastExercise?.sets ?? 0) || workout.session.prsAchieved.length > 0;

    if (workoutDone && !workout.session.isResting) {
      return (
        <WorkoutComplete
          session={workout.session}
          isSaving={workout.isSaving}
          saveError={workout.saveError}
          onRetrySave={workout.retrySave}
          onDone={() => {
            workout.dismissWorkout();
            refreshCompletedDays();
          }}
        />
      );
    }

    return (
      <ActiveWorkout
        session={workout.session}
        onCompleteSet={workout.completeSet}
        onSkipSet={workout.skipSet}
        onSkipRest={workout.skipRest}
        onEndWorkout={async () => {
          await workout.endWorkout();
        }}
        onUpdateWeight={workout.updateWeight}
        onUpdateSets={workout.updateSets}
        onDismiss={workout.dismissWorkout}
        onPause={workout.pauseWorkout}
        equipmentConfig={equipmentConfig}
      />
    );
  }

  // Paused workout for unauthenticated users — show resume page before the sign-in wall.
  if (!user && workout.pausedSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">Workout Paused</h1>
          <p className="text-gray-400">
            {workout.pausedSession.workout.programName} &middot; {workout.pausedSession.workout.dayOfWeek}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={workout.dismissWorkout}
            className="px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold transition"
          >
            Discard
          </button>
          <button
            onClick={workout.resumeWorkout}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition"
          >
            Resume
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <h1 className="text-4xl font-bold">Workout Tracker</h1>
        <p className="text-gray-400 text-center max-w-md">
          Progressive overload strength training. Track your workouts, see your progress.
        </p>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    );
  }

  // Checklist workout (e.g. Daily Mobility)
  if (checklistWorkout && user) {
    return (
      <ChecklistWorkout
        workout={checklistWorkout}
        userId={user.uid}
        onClose={() => {
          setChecklistWorkout(null);
          refreshCompletedDays();
        }}
      />
    );
  }

  if (loading || historyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const consistency = calculateWorkoutConsistency(
    sessions,
    activePrograms.map((program) => ({
      programId: program.id,
      week: currentWeek(program.id),
      days: getAvailableDays(program.id),
    })),
    today,
  );

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">{dayName}</h1>
        <p className="text-gray-400">{dateStr}</p>
      </div>

      <ConsistencyCard {...consistency} />

      {/* Resume Banner */}
      {workout.pausedSession && (
        <div className="mb-4 bg-indigo-950 border border-indigo-700 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-indigo-200">Workout paused</p>
            <p className="text-sm text-indigo-400 truncate">
              {workout.pausedSession.workout.programName} &middot; {workout.pausedSession.workout.dayOfWeek}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={workout.dismissWorkout}
              className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm font-semibold transition"
            >
              Discard
            </button>
            <button
              onClick={workout.resumeWorkout}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Programs */}
      {activePrograms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No programs loaded yet.</p>
          <p className="text-gray-500 text-sm mb-4">Go to Settings to import a program.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activePrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              week={currentWeek(program.id)}
              todaysWorkout={getTodaysWorkout(program.id)}
              availableDays={getAvailableDays(program.id)}
              completedDays={getCompletedDaysForProgram(program.id)}
              onStartWorkout={(w) => {
                if (isChecklistWorkout(w)) {
                  return startChecklistWorkout(w);
                }
                return workout.startWorkout(w, definitions, equipmentConfig ?? undefined, sessions);
              }}
              onSelectDay={(day) => {
                const w = getWorkoutsForDay(program.id, day);
                if (!w) return false;
                if (isChecklistWorkout(w)) {
                  return startChecklistWorkout(w);
                }
                return workout.startWorkout(w, definitions, equipmentConfig ?? undefined, sessions);
              }}
            />
          ))}
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
}
