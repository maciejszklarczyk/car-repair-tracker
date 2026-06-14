import { describe, it, expect } from "vitest";
import "./setup";
import { createMockContext } from "@/test/helpers";
import { DELETE } from "@/pages/api/repairs/[id]";

describe("smoke: test infrastructure", () => {
  it("unauthenticated DELETE returns 401", async () => {
    const ctx = createMockContext({ user: null, params: { id: "r1" } });
    const response = await DELETE(ctx);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });
});
