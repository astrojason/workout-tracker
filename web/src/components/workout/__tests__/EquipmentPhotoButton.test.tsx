import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EquipmentPhotoButton } from "../EquipmentPhotoButton";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import type { EquipmentAnalysis } from "@/lib/equipment-photo";

const analysis: EquipmentAnalysis = {
  name: "Seated Cable Row", equipmentType: "pulley", equipmentDetail: null,
  muscleGroups: ["back"], isUnilateral: false, isTimeBased: false,
  suggestedWeight: 80, reasoning: "Based on your Lat Pulldown",
};

function pick(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("EquipmentPhotoButton", () => {
  it("analyzes the chosen photo and reports the result with its reasoning", async () => {
    const onScan = vi.fn().mockResolvedValue(analysis);
    const onResult = vi.fn();
    render(<ErrorProvider><EquipmentPhotoButton onScan={onScan} onResult={onResult} /></ErrorProvider>);

    pick(new File(["x"], "row.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(analysis));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Seated Cable Row/)).toBeTruthy();
    expect(screen.getByText(/Based on your Lat Pulldown/)).toBeTruthy();
  });

  it("shows the actual error when the scan fails", async () => {
    const onScan = vi.fn().mockRejectedValue(new Error("OpenAI API error 529: overloaded"));
    const onResult = vi.fn();
    render(<ErrorProvider><EquipmentPhotoButton onScan={onScan} onResult={onResult} /></ErrorProvider>);

    pick(new File(["x"], "row.jpg", { type: "image/jpeg" }));

    await waitFor(() => expect(screen.getByText(/OpenAI API error 529: overloaded/)).toBeTruthy());
    expect(onResult).not.toHaveBeenCalled();
  });

  it("rejects non-image files without scanning", async () => {
    const onScan = vi.fn();
    render(<ErrorProvider><EquipmentPhotoButton onScan={onScan} onResult={vi.fn()} /></ErrorProvider>);
    pick(new File(["x"], "notes.txt", { type: "text/plain" }));
    await waitFor(() => expect(screen.getByText(/choose an image/i)).toBeTruthy());
    expect(onScan).not.toHaveBeenCalled();
  });
});
