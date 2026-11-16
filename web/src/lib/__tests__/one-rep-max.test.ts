import { describe, it, expect } from "vitest";
import { estimate1RM } from "../one-rep-max";

describe("estimate1RM", () => {
  it("uses the weight itself for a single", () => expect(estimate1RM(225, 1)).toBe(225));
  it("applies Epley for multiple reps", () => expect(estimate1RM(135, 8)).toBeCloseTo(171, 5));
  it("returns null for bodyweight, zero reps, or high-rep sets", () => {
    expect(estimate1RM(0, 8)).toBeNull();
    expect(estimate1RM(135, 0)).toBeNull();
    expect(estimate1RM(20, 25)).toBeNull();
  });
});
