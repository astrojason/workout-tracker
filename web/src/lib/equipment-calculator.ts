import type { Exercise, PlateConfiguration, EquipmentDisplay } from "./types";
import { barWeight, cleanWeight } from "./types";

// Available plates per side (weight, max count per side)
const DEFAULT_PLATES: { weight: number; maxPerSide: number }[] = [
  { weight: 45, maxPerSide: 1 },
  { weight: 35, maxPerSide: 1 },
  { weight: 25, maxPerSide: 2 },
  { weight: 10, maxPerSide: 2 },
  { weight: 5, maxPerSide: 1 },
  { weight: 2.5, maxPerSide: 1 },
  { weight: 1, maxPerSide: 1 },
  { weight: 0.75, maxPerSide: 1 },
  { weight: 0.5, maxPerSide: 1 },
];

const BAND_INFO: Record<string, { name: string; range: string }> = {
  Orange: { name: "Orange", range: "2-12 lbs" },
  Purple: { name: "Purple", range: "5-35 lbs" },
  Red: { name: "Red", range: "10-50 lbs" },
  Blue: { name: "Blue", range: "20-80 lbs" },
  Green: { name: "Green", range: "50-120 lbs" },
  Black: { name: "Black", range: "60-150 lbs" },
};

// ── Plate Calculator ──

function findPlates(
  target: number,
  plates: { weight: number; maxPerSide: number }[] = DEFAULT_PLATES
): { plates: { plate: number; count: number }[]; totalPerSide: number } | null {
  let remaining = target;
  const result: { plate: number; count: number }[] = [];
  const epsilon = 0.001;

  for (const plate of plates) {
    if (remaining < plate.weight - epsilon) continue;
    const maxCount = Math.min(plate.maxPerSide, Math.floor(remaining / plate.weight));
    if (maxCount > 0) {
      result.push({ plate: plate.weight, count: maxCount });
      remaining -= maxCount * plate.weight;
    }
  }

  if (Math.abs(remaining) < epsilon) {
    const total = result.reduce((sum, p) => sum + p.count * p.plate, 0);
    return { plates: result, totalPerSide: total };
  }
  return null;
}

function isLandmineExercise(exercise: Exercise): boolean {
  return exercise.name.toLowerCase().includes("landmine");
}

export function calculateBarbell(targetWeight: number, bWeight: number): PlateConfiguration {
  const perSideNeeded = (targetWeight - bWeight) / 2;

  if (perSideNeeded <= 0) {
    return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [] };
  }

  // Try exact match
  const exact = findPlates(perSideNeeded);
  if (exact) {
    return {
      targetWeight,
      barWeight: bWeight,
      achievedWeight: bWeight + exact.totalPerSide * 2,
      perSide: exact.plates,
    };
  }

  // Round up: try incrementally higher weights
  let attempt = perSideNeeded;
  const increment = 0.25;
  while (attempt < perSideNeeded + 50) {
    attempt += increment;
    const found = findPlates(attempt);
    if (found) {
      return {
        targetWeight,
        barWeight: bWeight,
        achievedWeight: bWeight + found.totalPerSide * 2,
        perSide: found.plates,
      };
    }
  }

  return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [] };
}

export function calculateLandmine(targetWeight: number, bWeight: number): PlateConfiguration {
  const oneSideNeeded = targetWeight - bWeight;

  if (oneSideNeeded <= 0) {
    return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [], isLandmine: true };
  }

  // Try exact match
  const exact = findPlates(oneSideNeeded);
  if (exact) {
    return {
      targetWeight,
      barWeight: bWeight,
      achievedWeight: bWeight + exact.totalPerSide,
      perSide: exact.plates,
      isLandmine: true,
    };
  }

  // Round up: try incrementally higher weights
  let attempt = oneSideNeeded;
  const increment = 0.25;
  while (attempt < oneSideNeeded + 50) {
    attempt += increment;
    const found = findPlates(attempt);
    if (found) {
      return {
        targetWeight,
        barWeight: bWeight,
        achievedWeight: bWeight + found.totalPerSide,
        perSide: found.plates,
        isLandmine: true,
      };
    }
  }

  return { targetWeight, barWeight: bWeight, achievedWeight: bWeight, perSide: [], isLandmine: true };
}

// ── PowerBlock ──

export function nearestPowerBlock(target: number): number {
  const clamped = Math.max(5, Math.min(50, target));
  return Math.round(clamped / 2.5) * 2.5;
}

// ── Display helpers ──

export function plateDisplayString(config: PlateConfiguration): string {
  if (config.perSide.length === 0) {
    return `Bar only (${cleanWeight(config.barWeight)} lbs)`;
  }
  return config.perSide.map((p) => `${p.count}x${cleanWeight(p.plate)}`).join(" + ");
}

export function plateFullDisplayString(config: PlateConfiguration): string {
  if (config.perSide.length === 0) {
    return `Bar only (${cleanWeight(config.barWeight)} lbs)`;
  }
  const plateStr = plateDisplayString(config);
  const label = config.isLandmine ? "One side" : "Each side";
  return `${label}: ${plateStr} (${cleanWeight(config.achievedWeight)} lbs)`;
}

function parseWeightFromDetail(detail: string): number | null {
  const cleaned = detail.replace(/lbs?/gi, "").replace(/s$/i, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function getEquipmentDisplay(exercise: Exercise, weight: number): EquipmentDisplay {
  switch (exercise.equipmentType) {
    case "barbell_45": {
      const landmine = isLandmineExercise(exercise);
      if (weight <= 45) return { type: "barbell", config: { targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [], isLandmine: landmine } };
      return { type: "barbell", config: landmine ? calculateLandmine(weight, 45) : calculateBarbell(weight, 45) };
    }

    case "barbell_35": {
      const landmine = isLandmineExercise(exercise);
      if (weight <= 35) return { type: "barbell", config: { targetWeight: 35, barWeight: 35, achievedWeight: 35, perSide: [], isLandmine: landmine } };
      return { type: "barbell", config: landmine ? calculateLandmine(weight, 35) : calculateBarbell(weight, 35) };
    }

    case "barbell_ez":
      if (weight <= 15) return { type: "barbell", config: { targetWeight: 15, barWeight: 15, achievedWeight: 15, perSide: [] } };
      return { type: "barbell", config: calculateBarbell(weight, 15) };

    case "powerblock": {
      if (exercise.equipmentDetail) {
        const dbWeight = parseWeightFromDetail(exercise.equipmentDetail);
        if (dbWeight !== null && dbWeight < 5) return { type: "dumbbell", weight: dbWeight };
      }
      if (weight > 0 && weight < 5) return { type: "dumbbell", weight };
      return { type: "powerblock", weight: weight > 0 ? nearestPowerBlock(weight) : 0 };
    }

    case "band": {
      const bandName = exercise.equipmentDetail || "Unknown";
      const info = BAND_INFO[bandName];
      return { type: "band", name: info?.name || bandName, range: info?.range || "" };
    }

    case "bodyweight":
      return { type: "bodyweight", detail: exercise.equipmentDetail };

    case "assisted_pullup":
      return { type: "assisted", weight, detail: exercise.equipmentDetail };

    case "kettlebell":
      return { type: "kettlebell", weight };
  }
}

export function equipmentDisplayText(display: EquipmentDisplay): string {
  switch (display.type) {
    case "barbell": return plateFullDisplayString(display.config);
    case "powerblock": return `PowerBlock: ${cleanWeight(display.weight)} lbs`;
    case "dumbbell": return `Dumbbell: ${cleanWeight(display.weight)} lbs`;
    case "band": return `${display.name} Band (${display.range})`;
    case "bodyweight": return display.detail || "Bodyweight";
    case "assisted": {
      if (display.weight > 0) {
        return display.detail
          ? `${display.detail} (~${cleanWeight(display.weight)} lb assistance)`
          : `${cleanWeight(display.weight)} lb assistance`;
      }
      return display.detail || "Assisted";
    }
    case "kettlebell": return `Kettlebell: ${cleanWeight(display.weight)} lbs`;
  }
}

export function equipmentShortText(display: EquipmentDisplay): string {
  switch (display.type) {
    case "barbell": return `${cleanWeight(display.config.achievedWeight)} lbs`;
    case "powerblock":
    case "dumbbell":
    case "kettlebell": return `${cleanWeight(display.weight)} lbs`;
    case "band": return `${display.name} Band`;
    case "bodyweight": return "BW";
    case "assisted": return display.weight > 0 ? `${cleanWeight(display.weight)} lb assist` : "Assisted";
  }
}
