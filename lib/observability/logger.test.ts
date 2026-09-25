import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("log", () => {
  it("emits one JSON object per line in production, with level/event/time and extra fields merged in", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("bet_created", { userId: "u1", stakeAmount: 25 });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({ level: "info", event: "bet_created", userId: "u1", stakeAmount: 25 });
    expect(typeof parsed.time).toBe("string");
  });

  it("routes warn/error to console.error, and debug/info to console.log", () => {
    vi.stubEnv("NODE_ENV", "production");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.debug("a");
    log.info("b");
    log.warn("c");
    log.error("d");

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("falls back to a human-readable line outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("bet_created", { userId: "u1" });

    expect(spy.mock.calls[0]![0]).toBe('[INFO] bet_created {"userId":"u1"}');
  });

  it("omits the trailing JSON blob outside production when there are no extra fields", () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("no_fields_here");

    expect(spy.mock.calls[0]![0]).toBe("[INFO] no_fields_here");
  });
});
