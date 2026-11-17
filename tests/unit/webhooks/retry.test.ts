import { describe, expect, it } from "bun:test";
import {
  DISABLE_AFTER_MS,
  MAX_ATTEMPTS,
  nextAttemptAt,
  RETRY_DELAYS_MS,
  retryable,
  shouldDisable,
  succeeded,
  webhookInternalHosts,
} from "@/lib/webhooks/retry";

const NOW = new Date("2026-11-16T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("succeeded() and retryable()", () => {
  it("counts any 2xx as delivered", () => {
    expect(succeeded({ status: 200 })).toBe(true);
    expect(succeeded({ status: 204 })).toBe(true);
    expect(succeeded({ status: 301 })).toBe(false);
    expect(succeeded({ error: "timeout", message: "" })).toBe(false);
  });

  it("tries again after a server error, a timeout or no connection", () => {
    expect(retryable({ status: 500 })).toBe(true);
    expect(retryable({ status: 503 })).toBe(true);
    expect(retryable({ error: "timeout", message: "" })).toBe(true);
    expect(retryable({ error: "failed", message: "ECONNREFUSED" })).toBe(true);
  });

  it("believes a 4xx — except 408, 409 and 429", () => {
    expect(retryable({ status: 400 })).toBe(false);
    expect(retryable({ status: 401 })).toBe(false);
    expect(retryable({ status: 404 })).toBe(false);
    expect(retryable({ status: 408 })).toBe(true);
    expect(retryable({ status: 409 })).toBe(true);
    expect(retryable({ status: 429 })).toBe(true);
  });

  it("follows no redirect and doesn't retry a blocked address", () => {
    expect(retryable({ status: 302 })).toBe(false);
    expect(retryable({ error: "blocked", message: "private" })).toBe(false);
  });
});

describe("nextAttemptAt()", () => {
  const down = { status: 503 } as const;

  it("waits 1 min, 5 min, 30 min, 2 h, 6 h — then gives up", () => {
    expect(MAX_ATTEMPTS).toBe(6);
    RETRY_DELAYS_MS.forEach((delay, i) => {
      expect(nextAttemptAt(i + 1, down, NOW)).toEqual(later(delay));
    });
    expect(nextAttemptAt(6, down, NOW)).toBeNull();
    expect(RETRY_DELAYS_MS.map((ms) => ms / 60_000)).toEqual([
      1, 5, 30, 120, 360,
    ]);
  });

  it("has nothing next after a success or a final no", () => {
    expect(nextAttemptAt(1, { status: 200 }, NOW)).toBeNull();
    expect(nextAttemptAt(1, { status: 410 }, NOW)).toBeNull();
  });
});

describe("shouldDisable()", () => {
  it("turns a webhook off after a full day of failures", () => {
    expect(shouldDisable(null, NOW)).toBe(false);
    expect(shouldDisable(new Date(NOW.getTime() - 60_000), NOW)).toBe(false);
    expect(
      shouldDisable(new Date(NOW.getTime() - DISABLE_AFTER_MS + 1), NOW),
    ).toBe(false);
    expect(shouldDisable(new Date(NOW.getTime() - DISABLE_AFTER_MS), NOW)).toBe(
      true,
    );
  });
});

describe("webhookInternalHosts()", () => {
  it("reads names and name:port, lowercased, and drops anything else", () => {
    expect(
      webhookInternalHosts(" n8n.acme.internal , Hooks.Local:8443,,http://x"),
    ).toEqual(["n8n.acme.internal", "hooks.local:8443"]);
    expect(webhookInternalHosts(undefined)).toEqual([]);
  });
});
