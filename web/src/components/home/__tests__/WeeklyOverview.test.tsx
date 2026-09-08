import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyOverview } from "../WeeklyOverview";

const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isoForDay(fullDay: string): string {
  const today = new Date();
  const dayIdx = today.getDay();
  const mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const target = new Date(monday);
  target.setDate(monday.getDate() + FULL_DAYS.indexOf(fullDay));
  return target.toLocaleDateString("en-CA");
}

describe("WeeklyOverview", () => {
  it("marks a skipped day with a dash and title, distinct from an untouched day", () => {
    render(
      <WeeklyOverview
        availableDays={["Monday", "Wednesday"]}
        completedDays={new Set()}
        skippedDays={new Set([isoForDay("Wednesday")])}
      />
    );

    expect(screen.getByTitle("Skipped")).toHaveTextContent("–");
  });

  it("treats a completed day as completed even if it is also marked skipped", () => {
    const wedISO = isoForDay("Wednesday");
    render(
      <WeeklyOverview
        availableDays={["Monday", "Wednesday"]}
        completedDays={new Set([wedISO])}
        skippedDays={new Set([wedISO])}
      />
    );

    expect(screen.queryByTitle("Skipped")).not.toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("renders normally when skippedDays is omitted", () => {
    render(<WeeklyOverview availableDays={["Monday"]} completedDays={new Set()} />);
    expect(screen.queryByTitle("Skipped")).not.toBeInTheDocument();
  });
});
