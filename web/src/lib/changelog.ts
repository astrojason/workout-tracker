export type ChangelogEntry = {
  version: string
  date: string
  changes: string[]
}

// Newest first. Add an entry here whenever package.json's version is bumped.
export const CHANGELOG: ChangelogEntry[] = [
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
