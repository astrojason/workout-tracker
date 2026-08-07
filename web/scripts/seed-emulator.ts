// web/scripts/seed-emulator.ts
//
// Seeds the Firestore emulator with representative OLD-schema data (the
// pre-exercise-library embedded exercise shape) plus a test Auth user, so
// migrate-exercise-library.ts and the running app can be dry-run against
// realistic data with zero risk to production Firestore.
//
// Usage (from web/, with `npm run emulators` already running in another terminal):
//   npm run seed:emulator

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "localhost:9099";

const PROJECT_ID = "demo-workout-tracker-emulator";
export const TEST_UID = "test-user-1";
const TEST_EMAIL = "test@example.com";

interface LegacyExerciseOverrides {
  id: string;
  order?: number;
  phase?: string;
  name: string;
  equipmentType?: string;
  equipmentDetail?: string | null;
  baseWeight?: { type: "fixed"; value: number } | { type: "progressive" };
  sets?: number;
  repMin?: number;
  repMax?: { type: "count"; value: number } | { type: "failure" };
  restSeconds?: number;
  progressionRule?: string;
}

// Matches LegacyExercise in src/lib/firestore.ts — the shape the app wrote
// before the exercise library existed.
function legacyExercise(overrides: LegacyExerciseOverrides) {
  return {
    order: 1,
    phase: "main",
    equipmentType: "barbell_45",
    equipmentDetail: null,
    baseWeight: { type: "fixed" as const, value: 135 },
    sets: 3,
    repMin: 8,
    repMax: { type: "count" as const, value: 10 },
    restSeconds: 120,
    progressionRule: "add_5lb",
    isUnilateral: false,
    isTimeBased: false,
    notes: null,
    ...overrides,
  };
}

async function main() {
  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  console.log(`Creating test user ${TEST_UID}...`);
  try {
    await auth.createUser({ uid: TEST_UID, email: TEST_EMAIL, displayName: "Emulator Test User" });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/uid-already-exists") throw err;
  }

  const userDoc = db.collection("users").doc(TEST_UID);

  // Program 1: Reacher Build — Bench Press appears Monday AND Thursday, at
  // DIFFERENT planned weights. This is exactly the sync bug the exercise
  // library exists to fix.
  await userDoc.collection("programs").doc("reacher-build").set({
    name: "Reacher Build",
    totalWeeks: 4,
    createdAt: Timestamp.now(),
    archived: false,
  });

  await userDoc.collection("workouts").doc("reacher-build_1_monday").set({
    programId: "reacher-build",
    programName: "Reacher Build",
    week: 1,
    dayOfWeek: "Monday",
    isChecklist: false,
    exercises: [
      legacyExercise({ id: "ex-mon-1", order: 1, name: "Bench Press", baseWeight: { type: "fixed", value: 135 } }),
      legacyExercise({
        id: "ex-mon-2", order: 2, name: "Barbell Row", progressionRule: "add_10lb",
        baseWeight: { type: "fixed", value: 115 },
      }),
    ],
  });

  await userDoc.collection("workouts").doc("reacher-build_1_thursday").set({
    programId: "reacher-build",
    programName: "Reacher Build",
    week: 1,
    dayOfWeek: "Thursday",
    isChecklist: false,
    exercises: [
      legacyExercise({ id: "ex-thu-1", order: 1, name: "Bench Press", baseWeight: { type: "fixed", value: 130 } }),
    ],
  });

  // Program 2: a second (archived) program that ALSO uses "Bench Press" —
  // tests that migration unifies the exercise across programs, not just
  // within one.
  await userDoc.collection("programs").doc("starting-strength").set({
    name: "Starting Strength",
    totalWeeks: 1,
    createdAt: Timestamp.now(),
    archived: true,
  });

  await userDoc.collection("workouts").doc("starting-strength_1_wednesday").set({
    programId: "starting-strength",
    programName: "Starting Strength",
    week: 1,
    dayOfWeek: "Wednesday",
    isChecklist: false,
    exercises: [
      legacyExercise({ id: "ex-ss-1", order: 1, name: "Bench Press", baseWeight: { type: "fixed", value: 125 } }),
    ],
  });

  // A completed session logging Bench Press heavier than any planned weight
  // above — migration should seed currentWeight from THIS, not from any plan.
  await userDoc.collection("sessions").add({
    programId: "reacher-build",
    programName: "Reacher Build",
    week: 1,
    dayOfWeek: "Monday",
    date: Timestamp.now(),
    completed: true,
    durationSeconds: 1800,
    sets: [
      {
        id: "set-1", exerciseName: "Bench Press", exerciseOrder: 1, setNumber: 1,
        targetWeight: 135, actualWeight: 140, targetReps: 8, actualReps: 8,
        completed: true, timestamp: Timestamp.now(), notes: null, rating: "normal",
        equipmentType: "barbell_45",
      },
      {
        id: "set-2", exerciseName: "Bench Press", exerciseOrder: 1, setNumber: 2,
        targetWeight: 135, actualWeight: 140, targetReps: 8, actualReps: 8,
        completed: true, timestamp: Timestamp.now(), notes: null, rating: "normal",
        equipmentType: "barbell_45",
      },
    ],
  });

  console.log("");
  console.log("Seed complete:");
  console.log(`  user:      ${TEST_UID} (${TEST_EMAIL})`);
  console.log("  programs:  Reacher Build (active), Starting Strength (archived)");
  console.log("  workouts:  Monday + Thursday (Reacher Build), Wednesday (Starting Strength)");
  console.log("             'Bench Press' appears in all 3, at 3 different planned weights (135/130/125)");
  console.log("  sessions:  1 completed session logging Bench Press @ 140 lbs");
  console.log("");
  console.log(`Next: npm run migrate:exercise-library:emulator -- ${TEST_UID}`);
  console.log(`Then: npm run dev:emulator, and sign in with a custom token for ${TEST_UID} to look around.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
