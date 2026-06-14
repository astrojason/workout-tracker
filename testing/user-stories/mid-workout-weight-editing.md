# Mid-Workout Weight and Set Editor

---

## Weight Override

**As a user editing weight before or during a set:**

- I can open the weight editor for any exercise at any point during the workout
- Changing the weight updates `resolvedWeights[exerciseId]` immediately
- The updated weight is shown on the current exercise card right away
- All remaining sets for that exercise use the new weight as `targetWeight`
- Previously completed sets for the same exercise retain their original `targetWeight`
- The change does not affect any other exercise in the workout
- The change does not persist to future sessions — next session still uses the planned weight

**Example:** I am on Set 2 of Landmine Press at 90 lbs. I change the weight to 85 lbs.
- Set 1 completed set record: `targetWeight: 90`
- Set 2 and Set 3: `targetWeight: 85`

---

## Set Count Override

**As a user editing set count mid-workout:**

- I can increase or decrease the number of sets for any exercise
- Increasing sets adds sets to the end of the exercise
- Decreasing sets below the current set number completes the exercise immediately
  and advances to the next exercise (or ends the workout if it was the last exercise)
- Decreasing sets to a number above the current set number removes future sets only —
  already completed sets are unaffected
- The change does not affect the program definition in Firestore

**Example:** I am on Set 2 of 4. I reduce to 3 sets.
- Sets 1 and 2 are already logged — unchanged
- Set 3 will be the final set
- Set 4 no longer exists for this session

**Example:** I am on Set 2 of 4. I reduce to 1 set.
- Set 1 is already logged — unchanged
- The exercise ends immediately and advances to the next exercise

---

## Equipment Display Updates on Weight Change

**As a user who changes the weight for a barbell exercise:**

- The plate configuration updates immediately to reflect the new weight
- The breakdown still uses the correct loading method for the equipment type
  (bilateral for standard barbell, single-side for landmine)
- If the new weight is not exactly achievable with available plates, the display
  shows the nearest achievable weight and its plate breakdown

---

## Weight Editor Does Not Affect Rest Timer

**As a user who opens the weight editor during a rest period:**

- The rest timer continues counting down while the editor is open
- Closing the editor (save or cancel) does not reset or restart the timer
- If the timer expires while the editor is open, the normal timer-complete
  behavior fires and the editor should close or become dismissible