import { describe, expect, it } from "vitest";
import { createUser, ensureDemoUser } from "./user-store";

describe("role (Section 12.3 RBAC)", () => {
  it("the demo account is the one mock-mode admin, so the demo experience can view /admin", () => {
    expect(ensureDemoUser().role).toBe("admin");
  });

  it("every other newly-created user defaults to role \"user\" - admin is never self-service", () => {
    const user = createUser(`rbac-test-${Date.now()}@example.com`);
    expect(user.role).toBe("user");
  });
});
