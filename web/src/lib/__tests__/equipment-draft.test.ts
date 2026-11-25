import { describe, expect, it } from "vitest";
import { rebaseDraft } from "../equipment-draft";

// When the saved equipment changes underneath the page's unsaved edits (an item saved on its own,
// or the first load), the draft takes the new saved values but keeps the edits you haven't saved.

type C = { plates: number; bars: string; items: string[] };
const saved: C = { plates: 2, bars: "45", items: [] };

describe("rebaseDraft", () => {
  it("takes the new saved values where you haven't edited", () => {
    expect(rebaseDraft(saved, saved, { ...saved, items: ["FitArc"] })).toEqual({ ...saved, items: ["FitArc"] });
  });

  it("keeps your unsaved edits to other parts", () => {
    const draft = { ...saved, plates: 3 };
    expect(rebaseDraft(draft, saved, { ...saved, items: ["FitArc"] })).toEqual({ plates: 3, bars: "45", items: ["FitArc"] });
  });

  it("ends up equal to what was saved after a full save", () => {
    const draft = { ...saved, plates: 3 };
    expect(rebaseDraft(draft, saved, draft)).toEqual(draft);
  });
});
