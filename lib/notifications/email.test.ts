import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAlertEmail } from "./email";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } }))
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
  // Not vi.restoreAllMocks() - that also wipes out the Resend constructor's
  // mockImplementation set up in the vi.mock() factory above, since it
  // isn't distinguishing "restore spies" from "reset every mock fn ever
  // created," leaving `new Resend()` returning undefined on later tests.
});

describe("sendAlertEmail", () => {
  it("no-ops without throwing when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;

    const sent = await sendAlertEmail({ to: "a@example.com", subjectLabel: "Ravens ML", message: "Edge reached 5.0pp.", triggeredAt: "2026-09-24T00:00:00Z" });

    expect(sent).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends via Resend with the required PRD 10.2 content (identity, evidence, timestamp, manage link) when configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_APP_URL = "https://edgehub.example";
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const sent = await sendAlertEmail({ to: "a@example.com", subjectLabel: "Ravens ML", message: "Edge reached 5.0pp.", triggeredAt: "2026-09-24T00:00:00Z" });

    expect(sent).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe("a@example.com");
    expect(call.html).toContain("Ravens ML");
    expect(call.html).toContain("Edge reached 5.0pp.");
    expect(call.html).toContain("2026-09-24T00:00:00Z");
    expect(call.html).toContain("https://edgehub.example/alerts");
  });

  it("escapes HTML in user-controlled fields rather than injecting it raw", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendAlertEmail({ to: "a@example.com", subjectLabel: '<img src=x onerror="alert(1)">', message: "fine", triggeredAt: "2026-09-24T00:00:00Z" });

    const call = sendMock.mock.calls[0]![0];
    expect(call.html).not.toContain("<img");
    expect(call.html).toContain("&lt;img");
  });

  it("returns false without throwing when Resend responds with an error", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({ data: null, error: { message: "invalid from address", name: "validation_error" } });

    const sent = await sendAlertEmail({ to: "a@example.com", subjectLabel: "x", message: "y", triggeredAt: "2026-09-24T00:00:00Z" });
    expect(sent).toBe(false);
  });

  it("returns false without throwing when the send call itself throws (network failure)", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockRejectedValue(new Error("ENOTFOUND"));

    const sent = await sendAlertEmail({ to: "a@example.com", subjectLabel: "x", message: "y", triggeredAt: "2026-09-24T00:00:00Z" });
    expect(sent).toBe(false);
  });

  it("defaults the From address to Resend's sandbox address when RESEND_FROM_EMAIL is unset", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.RESEND_FROM_EMAIL;
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendAlertEmail({ to: "a@example.com", subjectLabel: "x", message: "y", triggeredAt: "2026-09-24T00:00:00Z" });
    expect(sendMock.mock.calls[0]![0].from).toContain("onboarding@resend.dev");
  });
});
