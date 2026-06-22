# Web App Development Rules

## Error Handling — Non-Negotiable

- **Never swallow errors silently.** Every `catch` block must either re-throw or surface the error to the user.
- **All Firestore/API calls must be in try/catch.** No async call to an external service may execute without error handling.
- **User-facing errors must use `showError(err)` from `useError()` (ErrorProvider).** This displays the full error + stack trace in a modal the user can copy. Do not replace this with console.log, a vague string, or nothing.
- The only acceptable silent catches are for browser APIs that degrade gracefully: localStorage, WakeLock, clipboard. Document why with a comment.

## Definition of Done

Work is not complete until:
1. `npm run build` passes with no errors
2. All tests pass (`npm test`)
3. The specific behavior was manually verified in the browser

## Testing
Before completing any task, ensure all user stories in `testing/user-stories/` still pass. Do not break existing behavior described there.
