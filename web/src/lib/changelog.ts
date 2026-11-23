export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

// Newest first. Add an entry here whenever package.json's version is bumped.
export const CHANGELOG: ChangelogEntry[] = [
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
