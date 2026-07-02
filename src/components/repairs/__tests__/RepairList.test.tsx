import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RepairList from "@/components/repairs/RepairList";
import { resetRepairsStore } from "@/components/hooks/useRepairsStore";
import { makeRepair } from "@/test/helpers";

const repairs = [
  makeRepair({ id: "r1", description: "Oil change", cost: 500 }),
  makeRepair({ id: "r2", description: "Brake pads", cost: 300 }),
];

beforeEach(() => {
  vi.restoreAllMocks();
  resetRepairsStore();
});

describe("RepairList delete behavior", () => {
  it("removes deleted repair from rendered list after successful delete", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 200 }));
    const user = userEvent.setup();

    render(<RepairList initialRepairs={repairs} />);
    expect(screen.getByText("Oil change")).toBeInTheDocument();
    expect(screen.getByText("Brake pads")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText("Oil change")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Brake pads")).toBeInTheDocument();
  });

  it("keeps repair in list and shows error on delete failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
    );
    const user = userEvent.setup();

    render(<RepairList initialRepairs={repairs} />);

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Oil change").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Brake pads").length).toBeGreaterThan(0);
  });
});
