import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useGymMachines } from "../useGymMachines";
import type { GymMachine } from "@/lib/types";

const { showError, getGymMachines, createGymMachine, updateGymMachine, deleteGymMachine } = vi.hoisted(() => ({
  showError: vi.fn(),
  getGymMachines: vi.fn(),
  createGymMachine: vi.fn(),
  updateGymMachine: vi.fn(),
  deleteGymMachine: vi.fn(),
}));

vi.mock("@/components/providers/ErrorProvider", () => ({ useError: () => ({ showError }) }));
vi.mock("@/lib/firestore", () => ({ getGymMachines, createGymMachine, updateGymMachine, deleteGymMachine }));

const m = (id: string, name: string, plates = [10, 20]): GymMachine => ({ id, name, plates, createdAt: new Date(), updatedAt: new Date() });

beforeEach(() => {
  vi.clearAllMocks();
  getGymMachines.mockResolvedValue([m("m1", "Lat Pulldown")]);
});

describe("useGymMachines", () => {
  it("loads machines and keeps them sorted by name after create", async () => {
    createGymMachine.mockResolvedValue("m2");
    const { result } = renderHook(() => useGymMachines("u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.machines.map((x) => x.name)).toEqual(["Lat Pulldown"]);

    let ok = false;
    await act(async () => { ok = await result.current.create("Ab Crunch", [10, 20, 30]); });
    expect(ok).toBe(true);
    expect(createGymMachine).toHaveBeenCalledWith("u1", { name: "Ab Crunch", plates: [10, 20, 30] });
    expect(result.current.machines.map((x) => x.name)).toEqual(["Ab Crunch", "Lat Pulldown"]);
  });

  it("updates a machine in place", async () => {
    updateGymMachine.mockResolvedValue(undefined);
    const { result } = renderHook(() => useGymMachines("u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.update("m1", "Lat", [5, 10]); });
    expect(result.current.machines[0]).toMatchObject({ id: "m1", name: "Lat", plates: [5, 10] });
  });

  it("removes a machine", async () => {
    deleteGymMachine.mockResolvedValue(undefined);
    const { result } = renderHook(() => useGymMachines("u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.remove("m1"); });
    expect(deleteGymMachine).toHaveBeenCalledWith("u1", "m1");
    expect(result.current.machines).toEqual([]);
  });

  it("surfaces failures with showError, returns false, and leaves the list unchanged", async () => {
    const boom = new Error("permission denied");
    createGymMachine.mockRejectedValue(boom);
    const { result } = renderHook(() => useGymMachines("u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = true;
    await act(async () => { ok = await result.current.create("X", [1, 2]); });
    expect(ok).toBe(false);
    expect(showError).toHaveBeenCalledWith(boom);
    expect(result.current.machines).toHaveLength(1);
    expect(result.current.busyId).toBeNull();
  });

  it("reports a load failure with showError", async () => {
    const boom = new Error("offline");
    getGymMachines.mockRejectedValue(boom);
    const { result } = renderHook(() => useGymMachines("u1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(showError).toHaveBeenCalledWith(boom);
  });
});
