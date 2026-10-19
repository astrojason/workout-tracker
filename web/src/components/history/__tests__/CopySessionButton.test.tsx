import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import { CopySessionButton } from "../CopySessionButton";
import type { WorkoutSessionDoc } from "@/lib/types";

const session = {
  id: "s1", programId: "p1", programName: "Reacher Build", week: 2, dayOfWeek: "Monday",
  date: new Date(2026, 9, 12), completed: true, durationSeconds: 1800,
  sets: [{
    id: "a", exerciseName: "Squat", exerciseOrder: 1, setNumber: 1, targetWeight: 135, actualWeight: 135,
    targetReps: 5, actualReps: 5, completed: true, timestamp: new Date(), notes: null,
  }],
} as WorkoutSessionDoc;

function renderButton() {
  return render(<ErrorProvider><CopySessionButton session={session} /></ErrorProvider>);
}

describe("CopySessionButton", () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("copies the whole workout as markdown and confirms", async () => {
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Copy workout as Markdown" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const md = writeText.mock.calls[0][0] as string;
    expect(md).toContain("# Reacher Build — Monday, Week 2");
    expect(md).toContain("## Squat");
    expect(md).toContain("1. 5 reps @ 135 lb");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("shows the actual error when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("Clipboard permission denied"));
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Copy workout as Markdown" }));
    expect(await screen.findByText(/Clipboard permission denied/)).toBeInTheDocument();
  });
});
