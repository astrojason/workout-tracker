import type { ExerciseDefinition, GymMachine, Program, ResolvedExercise, UserEquipmentConfig, Workout } from "./types";
import { resolveExercise } from "./types";
import { warmupGroup, WARMUP_GROUPS, type WarmupGroup } from "./warmup-rules";
import { equipmentChoiceValue, equipmentOptionGroups } from "./equipment-choices";

export interface PreviewLift { exercise: ResolvedExercise; equipment: string }

// Lifts for the Warm-ups preview: from the active programs' days, each at its program's current
// weight with its real reps, up to `perGroup` per equipment group (in program order).
export function warmupPreviewLifts(
  programs: Program[], workouts: Workout[], definitions: Record<string, ExerciseDefinition>,
  config: UserEquipmentConfig, machines: GymMachine[], perGroup = 2,
): PreviewLift[] {
  const active = new Map(programs.filter((p) => !p.archived).map((p) => [p.id, p]));
  const seen = new Set<string>();
  const byGroup = new Map<WarmupGroup, PreviewLift[]>();
  const ordered = [...workouts].sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
  for (const w of ordered) {
    const program = active.get(w.programId ?? "");
    if (!program) continue;
    for (const occ of w.exercises) {
      if (occ.phase === "warmup" || seen.has(occ.definitionId) || !definitions[occ.definitionId]) continue;
      seen.add(occ.definitionId);
      const resolved = resolveExercise(occ, definitions);
      const weight = program.weights?.[occ.definitionId]?.currentWeight;
      const exercise = { ...resolved, id: `preview-${occ.definitionId}`, ...(weight !== undefined ? { currentWeight: weight } : {}) };
      const group = warmupGroup(exercise, config);
      const list = byGroup.get(group) ?? [];
      if (list.length >= perGroup) continue;
      const choice = equipmentChoiceValue(definitions[occ.definitionId], config);
      const label = equipmentOptionGroups(config, machines, choice).flatMap((g) => g.options).find((o) => o.value === choice)?.label ?? exercise.equipmentType;
      list.push({ exercise, equipment: label });
      byGroup.set(group, list);
    }
  }
  return WARMUP_GROUPS.flatMap(({ key }) => byGroup.get(key) ?? []);
}
