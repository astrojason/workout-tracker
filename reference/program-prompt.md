# Program-writing prompt

Paste the prompt below into an AI chat to have it write a program the app
can import. Fill in the `<...>` parts first. The column rules it relies on
are in `reference/exercise-import.md`, `reference/equipment.md` and
`reference/progression.md`. Attach those files too if the AI can read them.

---

```text
Write a training program as an .xlsx workbook for my workout tracker app.

ABOUT ME
- Goal: <e.g. hypertrophy, upper-body focus>
- Days per week: <e.g. Monday, Wednesday, Friday>
- Length: <e.g. 8 weeks>
- Bodyweight: <e.g. 180 lb>
- Limits / injuries: <or "none">
- Equipment I own (use ONLY this; never plan a weight I can't load):
  <paste your Equipment page: plates, bars, PowerBlock range, kettlebells,
   bands by colour, machines with their weight stacks, other items>

WORKBOOK FORMAT
- One sheet per training day, named exactly Monday … Sunday (or Daily).
- Row 1 is the header; one row per exercise per week. Columns, in this order:
  Week | Phase | Order | Exercise | Equip Type | Equip Detail | Total Weight |
  Sets | Rep Min | Rep Max | Last Set AMRAP | Rest (s) | Rest After |
  Progression | Unilateral | Is Timed | Muscles | Bodyweight % | Warm-up | Notes
- Week: 1…N. Phase: warmup, main, finisher, cooldown or mobility.
- Equip Type: barbell_45, barbell_35, barbell_ez, powerblock, dumbbell,
  kettlebell, band, loop_band, bodyweight, assisted_pullup, gripper, pulley,
  machine. Equip Detail: band colour (Orange, Purple, Red, Blue, Green, Black)
  or loop band size; blank otherwise.
- Total Weight: full weight incl. the bar, only weights my equipment makes;
  0 for bodyweight and bands; number of bands for assisted_pullup.
- Rep Max: a number or "failure". Rest (s): rest between this exercise's own sets.
- Progression: add_5lb, add_2.5lb, add_10lb, add_weight, add_reps, add_time,
  maintain, deload, none, or a band colour to move to.
- Use the exact same Exercise name every time a movement appears.

MUSCLES AND BODYWEIGHT (the app uses these to pick lighter warm-ups)
- Muscles: comma-separated, BIGGEST MUSCLE FIRST, from this list only:
  chest, shoulders, triceps, biceps, forearms, lats, upper back, lower back,
  core, quads, glutes, hamstrings, calves, hips, adductors.
  e.g. Push-up → "chest, triceps, shoulders"; Goblet Squat → "quads, glutes, hamstrings, core".
- Bodyweight %: how much of my bodyweight one rep lifts, 0–100.
  Push-up 64, knee push-up 49, incline push-up 41, dip 90, pull-up 95,
  inverted row 55, squat/lunge 75–80, hinge 40, glute bridge 30, standing calf
  raise 100. Anything where the body is supported (bench press, curls, rows,
  machines, cable work) is 0.

WARM-UPS
The app builds warm-ups itself: lighter sets of the same lift when my
equipment has a lighter load, otherwise one set of a LIGHTER MOVEMENT that
works the same biggest muscle (a banded press before push-ups, bodyweight
squats before a goblet squat). Do NOT add warmup-phase rows that just repeat a
lift lighter. Instead use the Warm-up column on each working row:
- Leave it blank to let the app decide (the usual case).
- Write "none" when this lift needs no warm-up on that day: it follows a lift
  that already warmed the same muscles, it's light accessory work, or the
  session's own warm-up covers it.
- Write an exercise name to choose the warm-up yourself. Prefer a lighter
  exercise that appears elsewhere in this program. For lifts nothing lighter
  can stand in for (kettlebell swings, Turkish get-ups, cleans, carries,
  sled work), name a short active stretch instead, e.g. "Leg Swings",
  "Arm Circles", "Hip Circles", "Cat-Cow", "Inchworms", "Band Dislocates".
  A new name like that becomes a bodyweight exercise in my library.
- Mobility or activation drills that aren't any lift's warm-up (band
  pull-aparts, external rotations) can still be warmup-phase rows of their own.

OUTPUT
Give me the .xlsx file. If you can't make files, give one CSV block per sheet
with the header row above, and I'll paste them into a workbook.
```
