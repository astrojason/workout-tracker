# Exercise Library Migration Checklist

Tracks rolling out the `feature/exercise-library` branch: a global, per-user
exercise library that workout-day exercises reference by id instead of
duplicating, plus a rating-driven progression engine. Full design/rationale is
in the branch's commit messages (`git log feature/exercise-library`).

Delete this file once the migration is done and the branch is merged — it's a
rollout aid, not permanent documentation (see `EQUIPMENT_MANAGER.md` for the
precedent of removing these once shipped).

## Why this needs a checklist, not just a merge

The new code requires every exercise to already have a `definitionId`. The
migration that adds it rewrites existing Workout documents (stripping the old
embedded fields), and it's manual — see `scripts/migrate-exercise-library.ts`
— specifically so it can't run automatically from a preview deployment against
production data before `main` is ready for it. **Wrong order breaks the live
app.**

## 1. Dry run against the emulator (do this first)

- [x] `npm run emulators` (separate terminal, leave running)
- [x] `npm run seed:emulator` — representative old-schema data
- [x] `npm run migrate:exercise-library:emulator -- test-user-1`
- [x] Inspected the resulting Firestore data directly — same-named exercises
      across programs/days correctly unified into one definition, weight
      seeded from logged history (not a stale plan)
- [x] `npm run dev:emulator`, signed in via `window.__emulatorSignIn(token)`
      (`npm run mint-token:emulator -- test-user-1`), confirmed the app
      renders and the same exercise shows the same weight on every day
- [x] Edited weight once via `/settings/exercises`, confirmed it propagated
      live to every occurrence
- [x] Confirmed session/PR history is untouched by the migration — both
      empirically (byte-for-byte diff before/after) and via a permanent test
      (`firestore-migrate-exercise-library.test.ts`)

## 2. Code review

- [x] `npm run build` clean
- [x] `npm test` clean (442/442 at last check)
- [ ] You've read through the branch's diff / commit messages yourself

## 3. Run the migration against PRODUCTION

Do this **before** deploying — the app assumes it already happened.

- [ ] Firebase Console → Project Settings → Service Accounts → Generate new
      private key. Save it **outside this repo**.
- [ ] `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/that-file.json`
- [ ] Find your production Firebase Auth uid (Console → Authentication →
      Users)
- [ ] From `web/`: `npm run migrate:exercise-library -- <your-uid>`
- [ ] Spot-check in the Firebase Console: `exerciseDefinitions` collection
      exists and looks right; a workout doc's `exercises` now has
      `definitionId` instead of `name`/`equipmentType`/etc.
- [ ] Delete the downloaded service account key (or note where it's kept, if
      you intend to reuse it for a future migration)

## 4. Deploy

- [ ] Merge `feature/exercise-library` → `main`
- [ ] Push `main` (triggers autodeploy)
- [ ] Load the live app, confirm it signs in and shows your workouts
      correctly (weights, exercise names, muscle groups if you've added any)
- [ ] Start a workout, confirm set completion / rest timer / weight editing
      still work end-to-end

## 5. After

- [ ] Delete this checklist file
- [ ] Optionally: back-fill muscle groups for exercises via
      `/settings/exercises` (empty by default — nothing in the old data had
      this)
