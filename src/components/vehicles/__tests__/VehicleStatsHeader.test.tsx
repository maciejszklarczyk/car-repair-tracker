import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import VehicleStatsHeader from "@/components/vehicles/VehicleStatsHeader";
import { useRepairsStore, resetRepairsStore } from "@/components/hooks/useRepairsStore";
import { makeRepair, makeVehicle } from "@/test/helpers";

beforeEach(() => {
  resetRepairsStore();
});

afterEach(() => {
  cleanup();
});

describe("VehicleStatsHeader", () => {
  it("renders mileage and cost/km computed from the initial repairs", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ id: "r1", mileage: 10500, cost: 500 })];

    render(<VehicleStatsHeader vehicle={vehicle} initialRepairs={repairs} />);

    expect(screen.getByText("Mileage: 10,500 km")).toBeInTheDocument();
    expect(screen.getByText(/1\.00 PLN\/km/)).toBeInTheDocument();
  });

  it("renders the no-cost-data fallback when cost/km cannot be computed", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    render(<VehicleStatsHeader vehicle={vehicle} initialRepairs={[]} />);

    expect(screen.getByText(/no cost data yet/)).toBeInTheDocument();
  });

  it("updates reactively when another store consumer deletes a repair", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [
      makeRepair({ id: "r1", mileage: 10500, cost: 500 }),
      makeRepair({ id: "r2", mileage: 11000, cost: 300 }),
    ];

    render(<VehicleStatsHeader vehicle={vehicle} initialRepairs={repairs} />);
    expect(screen.getByText("Mileage: 11,000 km")).toBeInTheDocument();

    const other = renderHook(() => useRepairsStore(repairs));
    act(() => {
      other.result.current[1]("r2");
    });

    expect(screen.getByText("Mileage: 10,500 km")).toBeInTheDocument();
  });
});
