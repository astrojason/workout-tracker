# Claude Code Guidelines

## Project structure

This is a mono-repo with two independent platforms:

- **`WorkoutTracker/`** — iOS 17+ SwiftUI app, built with XcodeGen (`project.yml`). No iOS SDK on this dev machine; build and run only through Xcode GUI.
- **`web/`** — Next.js 15 web app (App Router, Tailwind, Firebase/Firestore, vitest + Playwright).

All `npm` commands below must be run from the `web/` directory.

## Definition of done

A task is **not done** until:

1. The TypeScript build passes: `npm run build` (from `web/`).
2. All unit tests pass: `npm test` (from `web/`, runs vitest).
3. Any new behaviour has a corresponding Playwright test that was written **before** the implementation (see below).
4. Any relevant TODO.md item is marked complete (`- [x]`).
5. The specific behaviour was manually verified in the browser.

Never report a task as complete without running `npm run build` and confirming it exits cleanly.

## Test-driven workflow

All bugs and feature work must follow this cycle:

1. Write a Playwright test in `web/e2e/` (or a vitest test in `web/src/**/___tests__/`) that **fails** against the current code — confirming the bug exists or the new behaviour is missing.
2. Implement the fix or feature.
3. Repeat steps 1–2 until every test passes.
4. Confirm the build succeeds (`npm run build` from `web/`).
5. If the work corresponds to a TODO.md item, mark it complete (`- [x]`).

Before completing any task, ensure all user stories in `testing/user-stories/` still pass. Do not break existing behaviour described there.

The Playwright config launches the Next.js dev server automatically via `webServer`.

## Error handling

Nothing is allowed to fail silently. Every `catch` block — including `.catch()` chains — **must** surface the error in the UI.

Rules:
- Call `showError(err)` from the `useError()` hook (provided by `ErrorProvider`). This displays the full error and stack trace in a modal the user can copy.
- Show the **actual error message** (`err instanceof Error ? err.message : String(err)`), not a generic "Something went wrong."
- The `ErrorModal` component lives at `web/src/components/ui/ErrorModal.tsx`.
- No empty `catch {}`, no `catch(() => {})`, no `console.error`-only handlers.
- The only acceptable silent catches are browser APIs that degrade gracefully (localStorage, WakeLock, clipboard). Document why with a `// non-critical` comment.

## iOS app

- Source lives in `WorkoutTracker/` with sub-folders: `Models/`, `Services/`, `Views/`, `Persistence/`.
- `WorkoutManager` is the central `@Observable` state object, passed via `.environment()`.
- Build only through Xcode GUI — no CLI build available on this machine.
- XcodeGen config is `project.yml` at the repo root; regenerate the `.xcodeproj` with `xcodegen` if needed.

## TODO.md

Keep `TODO.md` up to date:

- Mark items complete (`- [x]`) once the work, tests, and build all pass.
- Add new bugs or planned features as they are identified.
