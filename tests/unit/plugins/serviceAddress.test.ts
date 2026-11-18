import { describe, expect, it } from "bun:test";
import {
  checkServiceAddress,
  serviceSummary,
  serviceUrlsFromEnv,
} from "@/lib/plugins/service";

// Where a plugin's server is, when someone other than its maker gives the
// address (BARY-223).

const none = { hosts: [], local: false };

describe("checkServiceAddress", () => {
  it("takes https, without the fragment", () => {
    expect(checkServiceAddress(" https://ci.acme.dev/hook#x ", none)).toEqual({
      ok: true,
      url: "https://ci.acme.dev/hook",
    });
  });

  it("takes plain http only where the operator allows it", () => {
    expect(checkServiceAddress("http://ci.acme.dev/hook", none)).toEqual({
      ok: false,
      error: "not_https",
    });
    expect(
      checkServiceAddress("http://gitea.corp:3000/hook", {
        hosts: ["gitea.corp:3000"],
        local: false,
      }).ok,
    ).toBe(true);
    expect(
      checkServiceAddress("http://localhost:4556/x", { hosts: [], local: true })
        .ok,
    ).toBe(true);
    expect(
      checkServiceAddress("http://barynt-github:8080/events", {
        hosts: [],
        local: false,
        plain: true,
      }).ok,
    ).toBe(true);
  });

  it("refuses what isn't an address, other schemes and credentials", () => {
    for (const raw of [
      "",
      "ci.acme.dev",
      "ftp://ci.acme.dev",
      "https://user:pw@ci.acme.dev",
      `https://ci.acme.dev/${"x".repeat(300)}`,
    ])
      expect(checkServiceAddress(raw, none)).toEqual({
        ok: false,
        error: "invalid_url",
      });
  });
});

describe("serviceUrlsFromEnv", () => {
  it("reads pluginId=url pairs and skips the rest", () => {
    const urls = serviceUrlsFromEnv(
      "barynt-github=http://barynt-github:8080/events, broken, X=https://x, ci=ftp://y",
    );
    expect([...urls]).toEqual([
      ["barynt-github", "http://barynt-github:8080/events"],
    ]);
    expect(serviceUrlsFromEnv(undefined).size).toBe(0);
  });
});

describe("serviceSummary", () => {
  it("says fixed when the manifest says nothing", () => {
    expect(
      serviceSummary({ url: "https://a.dev/x", events: ["issue.created"] }),
    ).toEqual({
      url: "https://a.dev/x",
      address: "fixed",
      events: ["issue.created"],
    });
    expect(serviceSummary({ address: "platform", events: [] }).url).toBeNull();
  });
});
