import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  forwardedHeaders,
  githubSignature,
  inboundDeliveryId,
  inboundEvent,
  verifyInbound,
} from "@/lib/plugins/inbound";

// How Barynt checks a webhook another service sends a plugin (BARY-215).

const body = '{"object_kind":"merge_request"}';

describe("verifyInbound()", () => {
  it("takes GitHub's signature over the raw body, and only that", () => {
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(githubSignature("s3cret", body)).toBe(sig);
    const ok = new Headers({ "x-hub-signature-256": sig });
    expect(verifyInbound("github", "s3cret", ok, body)).toBe(true);
    expect(verifyInbound("github", "other", ok, body)).toBe(false);
    expect(verifyInbound("github", "s3cret", ok, `${body} `)).toBe(false);
    expect(verifyInbound("github", "s3cret", new Headers(), body)).toBe(false);
    // generic plugins sign the same way.
    expect(verifyInbound("generic", "s3cret", ok, body)).toBe(true);
  });

  it("takes GitLab's token — the secret itself", () => {
    const ok = new Headers({ "x-gitlab-token": "s3cret" });
    expect(verifyInbound("gitlab", "s3cret", ok, body)).toBe(true);
    expect(
      verifyInbound(
        "gitlab",
        "s3cret",
        new Headers({ "x-gitlab-token": "s3creT" }),
        body,
      ),
    ).toBe(false);
    expect(verifyInbound("gitlab", "s3cret", new Headers(), body)).toBe(false);
  });
});

describe("what Barynt reads of a call", () => {
  it("names the event the way the rest of Barynt does", () => {
    expect(
      inboundEvent(
        "gitlab",
        new Headers({ "x-gitlab-event": "Merge Request Hook" }),
      ),
    ).toBe("merge_request");
    expect(
      inboundEvent("github", new Headers({ "x-github-event": "pull_request" })),
    ).toBe("pull_request");
    expect(inboundEvent("github", new Headers())).toBe("unknown");
  });

  it("finds the provider's delivery id, if it's a sane one", () => {
    expect(
      inboundDeliveryId(
        "github",
        new Headers({ "x-github-delivery": "abc-123" }),
      ),
    ).toBe("abc-123");
    expect(
      inboundDeliveryId(
        "gitlab",
        new Headers({ "x-gitlab-event-uuid": "0b1c-2d" }),
      ),
    ).toBe("0b1c-2d");
    expect(
      inboundDeliveryId(
        "github",
        new Headers({ "x-github-delivery": "a b<c>" }),
      ),
    ).toBeNull();
  });

  it("passes on only the provider's own headers — never its secret", () => {
    expect(
      forwardedHeaders(
        new Headers({
          "x-gitlab-event": "Push Hook",
          "x-gitlab-token": "s3cret",
          cookie: "x",
        }),
      ),
    ).toEqual({ "x-gitlab-event": "Push Hook" });
  });
});
