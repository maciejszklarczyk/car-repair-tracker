import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceThresholdList from "@/components/service-reminders/ServiceThresholdList";
import { makeServiceThreshold } from "@/test/helpers";
import type { ThresholdWithStatus } from "@/lib/serviceReminders";

const thresholds: ThresholdWithStatus[] = [
  {
    threshold: makeServiceThreshold({ id: "st1", name: "Oil change" }),
    status: "ok",
    km_remaining: 5000,
    days_remaining: null,
  },
  {
    threshold: makeServiceThreshold({ id: "st2", name: "Brake check" }),
    status: "approaching",
    km_remaining: 800,
    days_remaining: null,
  },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ServiceThresholdList delete behavior", () => {
  it("removes deleted threshold from rendered list after successful delete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
    const user = userEvent.setup();

    render(<ServiceThresholdList thresholds={thresholds} />);
    expect(screen.getByText("Oil change")).toBeInTheDocument();
    expect(screen.getByText("Brake check")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText("Oil change")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Brake check")).toBeInTheDocument();
  });

  it("keeps threshold in list and shows error on delete failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Cannot delete" }), { status: 500 }),
    );
    const user = userEvent.setup();

    render(<ServiceThresholdList thresholds={thresholds} />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("Cannot delete")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Oil change").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Brake check").length).toBeGreaterThan(0);
  });
});
