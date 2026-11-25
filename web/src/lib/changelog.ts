export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

// Newest first. Add an entry here whenever package.json's version is bumped.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.39.0',
    date: '2026-11-24',
    changes: [
      'History on desktop: your sessions in a list on the left (search by exercise, day or program; filter Completed, Partial or Skipped), and the selected session on the right.',
      'Edit a logged session in place: weight or bands, reps or time, rating, done/failed/skipped, notes and duration, or remove a set. Changes show as unsaved until you save; discarding, removing a set and deleting the session all ask first.',
      'Saving rebuilds the "last time" weights used when you next train. PR records and program weights are not recalculated by an edit.',
      'Body metrics, exercise progress and Copy a Logged Week sit below. Phones keep the existing History page.',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-11-24',
    changes: [
      'Exercise pages on desktop are now a full report: equipment, muscles and progression; working load and hard streak for the chosen program; heaviest set, best estimated 1RM, change, volume and sessions for 4 weeks to a year.',
      'A trend chart of estimated 1RM, top set weight or volume, with PRs marked; rep records (heaviest weight at each rep count) and how final sets felt.',
      'A set log of every set (warm-ups optional) with each session linked, paged 20 at a time and exportable as CSV.',
      'Assisted pull-ups are reported in bands, timed exercises in time and unweighted ones in reps. Phones keep the existing exercise page.',
    ],
  },
  {
    version: '1.37.0',
    date: '2026-11-24',
    changes: [
      'Program editor on desktop: adding or editing an exercise opens a panel that slides in from the right, full height below the top bar, with Save and Cancel pinned to its bottom. The exercise being edited stays highlighted in the list.',
      'The exercise editor has a close button. Phones keep the bottom sheet.',
    ],
  },
  {
    version: '1.36.3',
    date: '2026-11-24',
    changes: [
      'The Overview\'s consistency grid now follows the range picker (4 weeks, 12 weeks, 6 months or a year) instead of always showing 12 weeks.',
      'Overview headline numbers show the change on one line and what it\'s compared with ("vs prior 12 wk") on a smaller, fainter line below.',
    ],
  },
  {
    version: '1.36.2',
    date: '2026-11-24',
    changes: [
      'Overview lift table is sorted by how much each lift improved, most first.',
      'Each lift shows its own unit: assisted pull-ups in bands (fewer is progress), timed exercises as time, unweighted exercises in reps, including the change column and progression changes.',
      'Assisted pull-up band counts no longer count as pounds in volume.',
      'The Overview\'s consistency card shows your current streak and this week\'s planned sessions.',
    ],
  },
  {
    version: '1.36.1',
    date: '2026-11-24',
    changes: [
      'Desktop Home is now the Overview only: program cards, today\'s workout and Custom workout no longer show below it. They stay on phones.',
    ],
  },
  {
    version: '1.36.0',
    date: '2026-11-24',
    changes: [
      'Desktop Home now opens on an Overview report: sessions, volume, average duration, working sets and bodyweight for the last 4 weeks, 12 weeks, 6 months or a year, each compared with the period before.',
      'Overview charts weekly volume, shows a 12-week consistency grid, and lists recent sessions and automatic weight changes.',
      'The Overview lift table shows each lift\'s change, top-set trend, best estimated 1RM, last top set and hard streak, and lets you edit a program\'s working weight in place.',
      'Phones keep the workout-first Home.',
    ],
  },
  {
    version: '1.35.0',
    date: '2026-11-24',
    changes: [
      'Desktop layout: on wide screens the bottom nav becomes a top bar (app name, tabs, your email and the version), and pages use the extra width with flat sections and divider lines.',
      'Home on desktop: program cards side by side, with workout consistency, today\'s exercises ("Up today", linking to the program editor) and your three latest workouts in a side column.',
      'History, Settings, the program editor and exercise progress spread into columns on desktop. Phones keep the existing layout.',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-11-23',
    changes: [
      'Gym machines: add your machines (name plus the weights each can be set to) in Settings → Manage Gym Machines.',
      'Machine exercises can pick a gym machine and use its weights for the weight picker and progression; edit a machine once and every exercise using it follows.',
      'Deleting a machine asks first, and the exercises that used it keep its weights.',
    ],
  },
  {
    version: '1.33.1',
    date: '2026-11-23',
    changes: [
      'AMRAP sets are no longer rated: they always count as Hard, so the Easy/Normal/Hard buttons are hidden for them and an AMRAP set never bumps the next set\'s weight.',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-11-23',
    changes: [
      'After finishing an exercise, "+ Another set of …" (on the rest screen, or on the next exercise until you start it) adds one more set with its own reps and weight, prefilled from the set you just did. Handy for working up to a work weight. As the last set, it counts toward progression.',
      'The rest screen now shows the reps (or time) of the set coming up, along with its weight.',
      'Rest-complete notifications (iPhone and browser) include the next set\'s weight and reps. The Live Activity shows the reps too.',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-11-23',
    changes: [
      'New "+ Add Set" button during an exercise: add a set with its own reps and weight right where you are. You do it now, and the planned set moves to the next set number at its own weight. "Remove" takes it back out. A custom set never changes your working weight.',
    ],
  },
  {
    version: '1.31.0',
    date: '2026-11-23',
    changes: [
      'Every exercise outside the warm-up phase now gets at least one warm-up set, even with no warm-up row in the program: a ramp for barbell and PowerBlock lifts, one set at about half weight for other loaded lifts, and a half-reps set for bodyweight, band and timed exercises.',
      'New "Skip Warm-Up Sets" checkbox on an exercise in the program editor.',
      'iPhone app: rest-complete alerts now show as a banner while the app is open, not only when the phone is locked (silent, since the web app plays its own sound).',
    ],
  },
  {
    version: '1.30.0',
    date: '2026-11-23',
    changes: [
      'Import now understands general programs: a workbook with one sheet per weekday and Exercise / Sets / Reps / Weight / Notes columns (like Reacher_Build.xlsx). "2+1" sets, AMRAP rows, timed reps and weights like "42.5 lb" or "3 bands" are mapped to equipment and progression automatically.',
      'Import and Re-import ask about each exercise that is not in your library, one at a time: use an existing exercise or create a new one. Cancelling changes nothing.',
      'Importing under the name of an existing program is refused instead of overwriting it.',
      'Fixed the white border around the favicon.',
    ],
  },
  {
    version: '1.29.1',
    date: '2026-11-22',
    changes: [
      'Added a favicon that works in Safari and on the iPhone Home Screen (ICO, PNG and Apple touch icon).',
      'The one-time build of the per-user last-weights summary has been removed now that it exists. If an account ever has sessions but no summary, starting a workout shows an error instead of guessing.',
    ],
  },
  {
    version: '1.29.0',
    date: '2026-11-22',
    changes: [
      'The footer is now on every screen, including an active workout, a session, an exercise, and the changelog, and it is slimmer: the version sits on the same row as the tabs.',
      'iPhone app: a Home Screen widget (small, medium, and Lock Screen sizes) shows today\'s workout for each program and how your week is going.',
      'iPhone app: removed the extra empty strip under the footer.',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-11-22',
    changes: [
      'Faster home screen: it now loads only the last 7 days of history. Starting a workout and the custom-workout weight suggestion read a small per-user summary of each exercise\'s last sets instead of the full history; it is built automatically the first time it is needed.',
      'The coach loads its history only when you ask it, and the session page no longer loads history it does not use.',
      'iPhone app: a Live Activity on the Lock Screen and Dynamic Island shows the rest countdown and current set (and appears on a paired Apple Watch).',
      'The streak counter on the home screen only counts about the last week for now.',
    ],
  },
  {
    version: '1.27.1',
    date: '2026-11-22',
    changes: [
      'Faster first load: every program\'s workouts, completed days and skipped days now load at the same time instead of one after another.',
      'iPhone app: errors from inside the page (crashes, failed requests) now appear in a copyable banner instead of leaving a blank screen.',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-11-22',
    changes: [
      'New iPhone app (with an Apple Watch app) that wraps the web app: native Google sign-in, a rest-complete notification that arrives while your phone is locked, and a live set/rest-timer view on your watch.',
      'Added an app icon (favicon) for the web app.',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-11-16',
    changes: [
      'Custom workouts: log timed sets, mark sets as bodyweight, rate each set Easy/Normal/Hard, and see an estimated 1RM per set.',
      'Custom workouts suggest a weight from the exercise history, adjusted by rating and time since it was last done.',
      'Weight progression now holds after 2+ weeks away from an exercise and drops one increment after 4+ weeks.',
      'Body metrics: removed the redundant arm and thigh inputs, accept three decimals and whole numbers, and aligned the form fields.',
    ],
  },
  {
    version: '1.25.2',
    date: '2026-10-21',
    changes: [
      'Show bottom nav on the signed-out History page.',
      'Added a changelog page, linked from the version number in the footer.',
    ],
  },
  {
    version: '1.25.1',
    date: '2026-10-19',
    changes: [
      'Keep machines progressing and drop brand text from equipment detail.',
      'Add exercise brand, AI identify-from-name, fixed-weight machines, workout Markdown copy, set timer.',
      'Add Capacitor iOS shell with native Google sign-in.',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-10-18',
    changes: [
      'Scan equipment photos to fill in an exercise and suggest a working weight.',
    ],
  },
  {
    version: '1.24.0',
    date: '2026-10-13',
    changes: [
      'Take an imported exercise\'s progression rule from its working row.',
      'Add custom build-your-own workout; it counts for the day.',
    ],
  },
  {
    version: '1.23.0',
    date: '2026-10-10',
    changes: [
      'Check off the scheduled day on Home; stop warm-ups seeding working weights.',
      'Ramp warm-ups from the work weight; sheet weight only seeds the start.',
      'Let kettlebell add_weight exercises move up a bell on an AMRAP last set.',
    ],
  },
  {
    version: '1.22.0',
    date: '2026-10-09',
    changes: [
      'Progress add_weight kettlebell exercises by moving up a bell.',
      'Restore rating-based progression; cap AMRAP reps at 2× target.',
      'Undo a session\'s progression bump when the session is deleted.',
      'Base progression on reps achieved (Epley) instead of ratings.',
      'Label failed sets "Failed" in the summary and History.',
      'Fix Save & End duplicating sessions and several summary/History issues.',
      'Add History import for measurement columns from a program spreadsheet.',
      'Import baseline body measurements from the program spreadsheet.',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-10-08',
    changes: [
      'Show the app version inside the bottom nav.',
      'Note on the program page when the final set is AMRAP.',
      'Keep each spreadsheet row\'s own weight and band.',
      'Show set notes in session history.',
      'Add rest-timer notifications and PWA manifest.',
      'Switch the AI coach from Claude to OpenAI with shared token tracking.',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-10-07',
    changes: [
      'Track exercise weights per program; fix assisted-exercise band handling.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-10-06',
    changes: [
      'Add AI coach: review finished workouts and suggest adjustments.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-09-07',
    changes: [
      'Add deload/missed-session handling (mark a day skipped).',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-08-31',
    changes: [
      'Show previous performance on set cards.',
      'Expand smart scale metrics.',
      'Add body metrics tracking.',
      'Add live plate loading guide.',
      'Add workout consistency summary.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08-10',
    changes: [
      'Add loop_band equipment type.',
      'Add pulley equipment type for plate-loaded cable attachments.',
      'Fix rest timer skipping between sets; allow editing it; fix dumbbell import.',
    ],
  },
]
