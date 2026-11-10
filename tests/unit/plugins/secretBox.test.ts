import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { openSecret, sealSecret } from "@/lib/secret-box";

const saved = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!";
});
afterAll(() => {
  process.env.AUTH_SECRET = saved;
});

describe("secret box", () => {
  it("opens what it sealed", () => {
    const sealed = sealSecret("ghp_token", "plugin-source-token");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("ghp_token");
    expect(openSecret(sealed, "plugin-source-token")).toBe("ghp_token");
  });

  it("seals the same value differently each time", () => {
    expect(sealSecret("a", "p")).not.toBe(sealSecret("a", "p"));
  });

  it("keeps purposes apart", () => {
    expect(openSecret(sealSecret("a", "one"), "two")).toBeNull();
  });

  it("refuses a tampered or foreign value", () => {
    const [v, iv, tag, body] = sealSecret("secret", "p").split(".");
    const flipped = body.startsWith("A")
      ? `B${body.slice(1)}`
      : `A${body.slice(1)}`;
    expect(openSecret([v, iv, tag, flipped].join("."), "p")).toBeNull();
    expect(openSecret("plain text", "p")).toBeNull();
    expect(openSecret("v2.a.b.c", "p")).toBeNull();
  });

  it("can't open values after AUTH_SECRET changed", () => {
    const sealed = sealSecret("secret", "p");
    process.env.AUTH_SECRET = "another-secret-with-at-least-32-chars!!";
    expect(openSecret(sealed, "p")).toBeNull();
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!";
  });

  it("refuses to work without a proper AUTH_SECRET", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => sealSecret("x", "p")).toThrow();
    process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!";
  });
});
