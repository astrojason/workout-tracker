# Session Persistence and Crash Recovery

## Active Session Persistence

**As a user whose browser crashes or tab closes mid-workout:**

- On next load, my session is restored exactly where I left off
- My completed sets, current exercise, and current set number are all preserved
- If a rest timer was running, it resumes from the correct remaining time
- If the rest timer expired while the app was closed, I land on the correct next set — no sets are skipped

## Pause and Resume

**As a user who pauses a workout:**

- I tap Pause and the workout stops
- I am returned to the home screen where a Resume banner is visible
- The rest timer is cleared — I resume at the start of the current set (no mid-rest resume)
- Tapping Resume restores my session at the exact set I paused on
- If I close and reopen the app while paused, the Resume banner is still shown

## Dismiss

**As a user who dismisses a paused workout:**

- The session is permanently discarded
- No sets are saved to Firestore
- The Resume banner disappears
- I can start a new workout immediately

## Screen Wake Lock

**As a user during an active workout:**

- The screen does not dim or lock while I am in an active session
- If I switch tabs and return, the wake lock is re-acquired
- The wake lock is released when the workout ends or is dismissed