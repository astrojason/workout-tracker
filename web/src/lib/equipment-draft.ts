// The equipment pages edit a draft and save it with one Save. Some edits save on their own (your
// own items), which changes the saved equipment underneath the draft. Rebasing gives the draft the
// new saved values while keeping the parts you've edited and not saved yet.
export function rebaseDraft<T extends object>(draft: T, previousSaved: T, nextSaved: T): T {
  const out = { ...nextSaved };
  for (const key of Object.keys(draft) as (keyof T)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(previousSaved[key])) out[key] = draft[key];
  }
  return out;
}
