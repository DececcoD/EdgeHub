import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

const Sentry = await import("@sentry/nextjs");
const { captureException, captureMessage } = await import("./capture");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("captureException", () => {
  it("forwards a real Error to Sentry.captureException with extra context", () => {
    const error = new Error("boom");
    captureException(error, { route: "webhooks/stripe" });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, { extra: { route: "webhooks/stripe" } });
  });

  it("passes undefined context through as undefined, not an empty object", () => {
    const error = new Error("boom");
    captureException(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, undefined);
  });

  it("still calls Sentry.captureException for a non-Error thrown value", () => {
    captureException("a string was thrown", { source: "test" });
    expect(Sentry.captureException).toHaveBeenCalledWith("a string was thrown", { extra: { source: "test" } });
  });

  it("always logs structurally too, not just to Sentry", () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureException(new Error("boom"), { route: "x" });
    expect(logSpy).toHaveBeenCalled();
  });
});

describe("captureMessage", () => {
  it("forwards to Sentry.captureMessage with extra context", () => {
    captureMessage("invoice payment failed", { customerId: "cus_1" });
    expect(Sentry.captureMessage).toHaveBeenCalledWith("invoice payment failed", { extra: { customerId: "cus_1" } });
  });
});
