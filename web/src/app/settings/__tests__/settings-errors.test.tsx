import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import type { Program } from "@/lib/types";

// Phone Settings: every program and settings action that fails must show its error.

const fail = (what: string) => vi.fn().mockRejectedValue(new Error(`${what} failed`));
const programs = {
  active: { id: "p1", name: "Block B", totalWeeks: 12, createdAt: new Date() } as Program,
  archived: { id: "old", name: "Block A", totalWeeks: 8, createdAt: new Date(), archived: true } as Program,
};
const hook = {
  activePrograms: [programs.active],
  archivedPrograms: [programs.archived],
  settings: { defaultRestSeconds: 120, soundEnabled: true, currentWeeks: { p1: 3 } },
  currentWeek: () => 3,
  setCurrentWeek: fail("Changing the week"),
  importXLSX: vi.fn(),
  reimportProgram: vi.fn(),
  archiveProgram: fail("Archiving"),
  unarchiveProgram: fail("Unarchiving"),
  deleteProgram: fail("Deleting"),
  renameProgram: vi.fn(),
  updateUserSettings: fail("Saving the setting"),
};

vi.mock("@/lib/firebase", () => ({ db: {}, auth: {} }));
vi.mock("@/hooks/usePrograms", () => ({ usePrograms: () => hook }));
vi.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "you@example.com" }, signOut: vi.fn() }),
}));

import SettingsPage from "../page";

function renderPage() {
  return render(<ErrorProvider><SettingsPage /></ErrorProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("phone Settings error reporting", () => {
  it("shows a failed archive", async () => {
    renderPage();
    fireEvent.click(screen.getByTitle("Archive program"));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByText(/Archiving failed/)).toBeTruthy();
  });

  it("shows a failed delete", async () => {
    renderPage();
    fireEvent.click(screen.getAllByTitle("Delete program")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Deleting failed/)).toBeTruthy();
  });

  it("shows a failed unarchive", async () => {
    renderPage();
    fireEvent.click(screen.getByText(/1 archived program/));
    fireEvent.click(screen.getByRole("button", { name: /Reactivate/ }));
    expect(await screen.findByText(/Unarchiving failed/)).toBeTruthy();
  });

  it("shows a failed week change", async () => {
    renderPage();
    fireEvent.change(screen.getByDisplayValue("Week 3"), { target: { value: "4" } });
    expect(await screen.findByText(/Changing the week failed/)).toBeTruthy();
  });

  it("shows a failed rest change", async () => {
    renderPage();
    fireEvent.change(screen.getByDisplayValue("120s"), { target: { value: "90" } });
    expect(await screen.findByText(/Saving the setting failed/)).toBeTruthy();
  });

  it("shows a failed timer sound change", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("switch", { name: "Timer Sound" }));
    await waitFor(() => expect(hook.updateUserSettings).toHaveBeenCalledWith({ soundEnabled: false }));
    expect(await screen.findByText(/Saving the setting failed/)).toBeTruthy();
  });
});
