"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePrograms } from "@/hooks/usePrograms";
import { useWorkout } from "@/hooks/useWorkout";
import { ProgramCard } from "@/components/home/ProgramCard";
import { ActiveWorkout } from "@/components/workout/ActiveWorkout";
import { WorkoutComplete } from "@/components/workout/WorkoutComplete";
import { ChecklistWorkout } from "@/components/workout/ChecklistWorkout";
import { isChecklistWorkout } from "@/lib/types";
import type { Workout } from "@/lib/types";
import Link from "next/link";

export default function HomePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { programs, settings, loading, getTodaysWorkout, getAvailableDays, getCompletedDaysForProgram, currentWeek, importCSV, refreshCompletedDays, getWorkoutsForDay } = usePrograms(user?.uid ?? null);
  const workout = useWorkout(user?.uid ?? null);
  const [checklistWorkout, setChecklistWorkout] = useState<Workout | null>(null);

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

  // Active workout overlay
  if (workout.session) {
    const isComplete = workout.session.prsAchieved.length > 0 ||
      (workout.session.completedSets.length > 0 &&
        workout.session.currentExerciseIndex >= workout.session.workout.exercises.length - 1 &&
        !workout.session.isResting);

    // Check if workout is truly done (all sets of last exercise completed)
    const lastExercise = workout.session.workout.exercises[workout.session.workout.exercises.length - 1];
    const lastExerciseSets = workout.session.completedSets.filter(s => s.exerciseOrder === lastExercise?.order).length;
    const workoutDone = lastExerciseSets >= (lastExercise?.sets ?? 0) || workout.session.prsAchieved.length > 0;

    if (workoutDone && !workout.session.isResting) {
      return (
        <WorkoutComplete
          session={workout.session}
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
        showHardPrompt={workout.showHardPrompt}
        onHardWeightDecision={workout.handleHardWeightDecision}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">{dayName}</h1>
        <p className="text-gray-400">{dateStr}</p>
      </div>

      {/* Programs */}
      {programs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No programs loaded yet.</p>
          <p className="text-gray-500 text-sm mb-4">Go to Settings to import a CSV program.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              week={currentWeek(program.name)}
              todaysWorkout={getTodaysWorkout(program.name)}
              availableDays={getAvailableDays(program.name)}
              completedDays={getCompletedDaysForProgram(program.name)}
              onStartWorkout={(w) => {
                if (isChecklistWorkout(w)) {
                  setChecklistWorkout(w);
                } else {
                  workout.startWorkout(w);
                }
              }}
              onSelectDay={(day) => {
                const w = getWorkoutsForDay(program.name, day);
                if (w) {
                  if (isChecklistWorkout(w)) {
                    setChecklistWorkout(w);
                  } else {
                    workout.startWorkout(w);
                  }
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around">
          <Link href="/" className="flex flex-col items-center text-indigo-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-xs mt-1">History</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center text-gray-500 hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
