import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRepairsStore, resetRepairsStore } from "@/components/hooks/useRepairsStore";
import { makeRepair } from "@/test/helpers";

beforeEach(() => {
  resetRepairsStore();
});

describe("useRepairsStore", () => {
  it("returns the seeded initial repairs on first render", () => {
    const seed = [makeRepair({ id: "r1" }), makeRepair({ id: "r2" })];
    const { result } = renderHook(() => useRepairsStore(seed));

    expect(result.current[0]).toHaveLength(2);
    expect(result.current[0].map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("removes the repair and re-renders with the updated snapshot on delete", () => {
    const seed = [makeRepair({ id: "r1" }), makeRepair({ id: "r2" })];
    const { result } = renderHook(() => useRepairsStore(seed));

    act(() => {
      result.current[1]("r1");
    });

    expect(result.current[0].map((r) => r.id)).toEqual(["r2"]);
  });

  it("shares the singleton store across multiple consumers", () => {
    const seed = [makeRepair({ id: "r1" }), makeRepair({ id: "r2" })];
    const first = renderHook(() => useRepairsStore(seed));
    const second = renderHook(() => useRepairsStore(seed));

    act(() => {
      first.result.current[1]("r1");
    });

    expect(second.result.current[0].map((r) => r.id)).toEqual(["r2"]);
  });

  it("reseeds fresh data after resetRepairsStore", () => {
    const seed = [makeRepair({ id: "r1" })];
    const first = renderHook(() => useRepairsStore(seed));
    act(() => {
      first.result.current[1]("r1");
    });
    expect(first.result.current[0]).toHaveLength(0);

    resetRepairsStore();

    const newSeed = [makeRepair({ id: "r2" }), makeRepair({ id: "r3" })];
    const second = renderHook(() => useRepairsStore(newSeed));
    expect(second.result.current[0].map((r) => r.id)).toEqual(["r2", "r3"]);
  });
});
