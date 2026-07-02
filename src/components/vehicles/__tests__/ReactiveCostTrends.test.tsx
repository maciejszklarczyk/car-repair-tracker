import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import ReactiveCostTrends from "@/components/vehicles/ReactiveCostTrends";
import { useRepairsStore, resetRepairsStore } from "@/components/hooks/useRepairsStore";
import { makeRepair, makeVehicle } from "@/test/helpers";

beforeEach(() => {
  resetRepairsStore();
});

afterEach(() => {
  cleanup();
});

describe("ReactiveCostTrends", () => {
  it("renders nothing when fewer than 2 points exist in every series", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ id: "r1", mileage: 10500, cost: 500, repair_date: "2024-06-01" })];

    const { container } = render(<ReactiveCostTrends vehicle={vehicle} initialRepairs={repairs} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Cost Trends")).not.toBeInTheDocument();
  });

  it("renders the heading and chart when the threshold is met", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [
      makeRepair({ id: "r1", mileage: 10500, cost: 500, repair_date: "2024-06-01" }),
      makeRepair({ id: "r2", mileage: 11000, cost: 300, repair_date: "2024-07-01" }),
    ];

    render(<ReactiveCostTrends vehicle={vehicle} initialRepairs={repairs} />);

    expect(screen.getByText("Cost Trends")).toBeInTheDocument();
  });

  it("disappears without a remount when a delete drops below threshold", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [
      makeRepair({ id: "r1", mileage: 10500, cost: 500, repair_date: "2024-06-01" }),
      makeRepair({ id: "r2", mileage: 11000, cost: 300, repair_date: "2024-07-01" }),
    ];

    render(<ReactiveCostTrends vehicle={vehicle} initialRepairs={repairs} />);
    expect(screen.getByText("Cost Trends")).toBeInTheDocument();

    const other = renderHook(() => useRepairsStore(repairs));
    act(() => {
      other.result.current[1]("r2");
    });

    expect(screen.queryByText("Cost Trends")).not.toBeInTheDocument();
  });
});
