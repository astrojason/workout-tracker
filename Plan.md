# Feature / Enhancement Pitch

## Current state (context)

Solid MVP already in place: program/exercise CRUD, per-exercise equipment configs
(barbell/dumbbell/kettlebell/PowerBlock/bands/loop bands/gripper/assisted-pullup),
a checklist-vs-set workout mode, a rest timer, CSV/XLSX import, and PR detection
(weight/1RM/volume) with a per-exercise history chart via Recharts.

## Tier 1 — cheap, high-impact (ship these first)

1. **"Last time you did this" inline on ExerciseCard.** Show last session's
   weight/reps right next to the input during a set, not two taps away on the
   exercise detail page. Highest-leverage UX change for progressive overload —
   the data is already fetched for PR checks.
2. **Deload / missed-session handling.** Explicitly mark a day skipped vs.
   completed rather than letting it show up as silence in history — matters for
   progression logic.

## Tier 2 — moderate effort, strong differentiators

3. **Body-weight / measurements tracking.** Weekly weigh-in + optional
   measurements, charted alongside lift progress.
4. **Workout notes / RPE per set.** Optional field on `CompletedSet` ("felt
   heavy," RPE 8) — turns the log into a training journal.
5. **Auto-progression suggestions surfaced in-UI.** `progression-service.ts`
   already computes this — show the reasoning ("last time: 135×8, suggested
   today: 140×6") at the top of the workout instead of leaving it invisible.
6. **Apple Watch companion (iOS side).** WatchKit extension showing current
   exercise + rest timer + a "log set" button, built on the existing
   `WorkoutManager` domain model. Solves the no-phone-in-hand-between-sets pain.

## Tier 3 — bigger bets

7. **Program templates / sharing.** "Duplicate as new program" plus
   export/import of a full program (not just history via `week-export.ts`).
8. **Multi-metric dashboard on History.** Cross-exercise volume/1RM trends,
    extending existing Recharts infrastructure.
9. **Push notifications** for rest-timer-done and "time to train" reminders
    (service worker + permission flow).

## Equipment coverage (loose threads from reference/equipment.md)

The equipment-type gap itself is closed (`pulley` and `loop_band` were the
last two additions per git history) — these are the two remaining
documented loose ends, both narrow:

10. **Loop band resistance ranges.** Serious Steel bands show a known lb
    range per color (`equipment-calculator.ts`); loop bands don't, because no
    lb range data exists for them yet. Low priority — blocked on sourcing the
    manufacturer's numbers, not on engineering effort.
11. **Loop band `Equip Detail` validation.** Band colors must match the known
    list exactly or display as "Unknown Band"; loop band sizes aren't
    validated at all — any string is accepted and shown as-is. Cheap
    consistency fix if it ever causes a real mismatch in practice.

## Explicitly not building right now

Social features, leaderboards, or multi-user anything — this is a single-user
tool (auth is literally the owner's own email) and the codebase isn't
structured for it.

## Recommended starting point

**#1 — "last time" inline on the set card.** A few hours of work, touches code
already understood (`ExerciseCard.tsx` + existing Firestore queries), and is
the highest-frequency touchpoint in the app.
