import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConsistencyCard } from "../ConsistencyCard";

describe("ConsistencyCard", () => {
  it("surfaces the current streak and weekly planned-session progress", () => {
    render(<ConsistencyCard currentStreak={3} completedThisWeek={3} plannedThisWeek={4} />);

    expect(screen.getByText("3 day streak")).toBeInTheDocument();
    expect(screen.getByText("This week: 3/4 planned sessions")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Weekly workout progress" })).toHaveAttribute("aria-valuenow", "3");
  });

  it("uses sensible singular and no-plan copy", () => {
    const { rerender } = render(
      <ConsistencyCard currentStreak={1} completedThisWeek={0} plannedThisWeek={1} />,
    );
    expect(screen.getByText("1 day streak")).toBeInTheDocument();

    rerender(<ConsistencyCard currentStreak={0} completedThisWeek={0} plannedThisWeek={0} />);
    expect(screen.getByText("No sessions planned this week")).toBeInTheDocument();
  });
});
