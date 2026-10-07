"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { auth } from "@/lib/firebase";
import {
  getAllWorkoutsForProgram,
  getProgram,
  saveWorkout,
  updateProgramExerciseWeight,
} from "@/lib/firestore";
import {
  applyStructureAdjustment,
  pickRecentSessions,
  toCoachSet,
  type CoachInput,
  type CoachResponse,
} from "@/lib/coach";
import { scopeDefinitions } from "@/lib/types";
import type { CompletedSet, ExerciseDefinition, Workout, WorkoutSessionDoc } from "@/lib/types";
import { CoachPanel } from "./CoachPanel";

interface CoachSectionProps {
  programId: string;
  programName: string;
  week: number;
  dayOfWeek: string;
  durationSeconds: number;
  sets: CompletedSet[];
  prs: CoachInput["prs"];
  sessionDate: Date;                       // history is limited to sessions before this
  sessions: WorkoutSessionDoc[];
  definitions: Record<string, ExerciseDefinition>;
  onSaveWorkout?: (workout: Workout) => Promise<void>; // lets the caller refresh its own workout cache
  onApplied?: () => void;                  // e.g. reload exercise definitions
}

export function CoachSection(props: CoachSectionProps) {
  const { user } = useAuth();
  const { programId, week } = props;

  // The library with this program's weights laid over it, read fresh so suggestions and
  // applied changes always work from the program's current weights.
  async function programDefinitions(userId: string): Promise<Record<string, ExerciseDefinition>> {
    return scopeDefinitions(props.definitions, (await getProgram(userId, programId)) ?? undefined);
  }

  async function upcomingWorkouts(userId: string): Promise<Workout[]> {
    const all = await getAllWorkoutsForProgram(userId, programId);
    return all.filter((w) => w.week >= week && w.week <= week + 1);
  }

  async function ask() {
    if (!user) throw new Error("Sign in to ask the coach");
    const definitions = await programDefinitions(user.uid);
    const defByName = (name: string) => Object.values(definitions).find((d) => d.name === name);
    const upcoming = await upcomingWorkouts(user.uid);
    const input: CoachInput = {
      programName: props.programName,
      week,
      dayOfWeek: props.dayOfWeek,
      durationSeconds: props.durationSeconds,
      sets: props.sets.map(toCoachSet),
      prs: props.prs,
      recentSessions: pickRecentSessions(props.sessions, programId, props.sessionDate),
      upcoming: upcoming.map((w) => ({
        week: w.week,
        dayOfWeek: w.dayOfWeek,
        exercises: w.exercises.map((e) => ({
          name: definitions[e.definitionId]?.name ?? e.definitionId,
          sets: e.sets,
          repMin: e.repMin,
          repMax: e.repMax.type === "count" ? String(e.repMax.value) : "failure",
          weight: definitions[e.definitionId]?.currentWeight ?? 0,
        })),
      })),
    };

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sign in to ask the coach");
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as CoachResponse & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `Coach request failed (${res.status})`);

    return {
      feedback: body.feedback,
      adjustments: body.adjustments.map((a) => {
        const def = defByName(a.exerciseName);
        let from: number | null = null;
        if (a.field === "weight") from = def?.currentWeight ?? null;
        else {
          const ex = upcoming.flatMap((w) => w.exercises).find((e) => e.definitionId === def?.id);
          from = ex ? (a.field === "sets" ? ex.sets : ex.repMin) : null;
        }
        return { ...a, from };
      }),
    };
  }

  async function apply(s: { exerciseName: string; field: "weight" | "sets" | "repMin"; to: number }) {
    if (!user) throw new Error("Sign in to apply coach changes");
    const definitions = await programDefinitions(user.uid);
    const def = Object.values(definitions).find((d) => d.name === s.exerciseName);
    if (!def) throw new Error(`Exercise "${s.exerciseName}" not found in your library`);
    if (s.field === "weight") {
      await updateProgramExerciseWeight(user.uid, programId, def.id, s.to, def.hardStreak);
    } else {
      const changed = applyStructureAdjustment(await upcomingWorkouts(user.uid), def.id, s.field, s.to, week);
      for (const w of changed) await (props.onSaveWorkout ?? ((x) => saveWorkout(user.uid, x)))(w);
    }
    props.onApplied?.();
  }

  return <CoachPanel onAsk={ask} onApply={apply} />;
}
