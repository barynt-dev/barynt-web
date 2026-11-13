import { describe, expect, it } from "bun:test";
import {
  credentialHeader,
  credentialScopeKey,
  isTextType,
  parseProxyRequest,
  pickResponseHeaders,
} from "@/lib/plugins/proxy";

// The host proxy's rules (BARY-147): which requests go out, with which
// headers, and how a credential becomes a header.

const network = ["api.acme.example"];
const parse = (input: unknown, internal: string[] = []) =>
  parseProxyRequest(input, network, internal);

describe("parseProxyRequest", () => {
  it("takes an https request to a host from network", () => {
    const req = parse({
      url: "https://api.acme.example/v1/items?x=1",
      method: "post",
      headers: { "Content-Type": "application/json", "X-Trace": "1" },
      body: "{}",
    });
    expect(typeof req).toBe("object");
    if (typeof req === "object") {
      expect(req.method).toBe("POST");
      expect(req.headers).toEqual({
        "content-type": "application/json",
        "x-trace": "1",
      });
    }
  });

  it("refuses any other host, scheme, port or user", () => {
    for (const url of [
      "https://evil.example/",
      "http://api.acme.example/",
      "https://api.acme.example:8443/",
      "https://me:pw@api.acme.example/",
      "https://API.acme.example.evil.example/",
    ])
      expect(parse({ url })).toBe("host_not_allowed");
  });

  it("lets a port through only for a host an admin listed with it", () => {
    expect(
      typeof parse({ url: "https://api.acme.example:8443/" }, [
        "api.acme.example:8443",
      ]),
    ).toBe("object");
  });

  it("drops headers a plugin mustn't set", () => {
    const req = parse({
      url: "https://api.acme.example/",
      headers: {
        Authorization: "Bearer stolen",
        Cookie: "a=b",
        Host: "other",
        "X-Forwarded-For": "1.2.3.4",
        "X-Bad": "a\r\nInjected: 1",
      },
    });
    expect(typeof req === "object" && req.headers).toEqual({});
  });

  it("refuses a body on GET and an unknown method", () => {
    expect(parse({ url: "https://api.acme.example/", body: "x" })).toBe(
      "invalid_params",
    );
    expect(parse({ url: "https://api.acme.example/", method: "CONNECT" })).toBe(
      "invalid_params",
    );
  });
});

describe("the rest", () => {
  it("passes on only the response headers a plugin may read", () => {
    expect(
      pickResponseHeaders({
        "Content-Type": "application/json",
        "set-cookie": ["a=b"],
        "x-ratelimit-remaining": "10",
        server: "nginx",
      }),
    ).toEqual({
      "content-type": "application/json",
      "x-ratelimit-remaining": "10",
    });
  });

  it("turns a credential into its header", () => {
    expect(
      credentialHeader(
        { header: "PRIVATE-TOKEN", format: "{value}" },
        "glpat-1\r\n",
      ),
    ).toEqual(["private-token", "glpat-1"]);
    expect(
      credentialHeader(
        { header: "Authorization", format: "Bearer {value}" },
        "t",
      ),
    ).toEqual(["authorization", "Bearer t"]);
  });

  it("keeps a credential per workspace, project or person", () => {
    const place = { workspaceId: "w", projectId: "p" };
    expect(credentialScopeKey("workspace", place, "u")).toBe("ws:w");
    expect(credentialScopeKey("project", place, "u")).toBe("pr:p");
    expect(credentialScopeKey("user", place, "u")).toBe("us:u");
    expect(
      credentialScopeKey("project", { workspaceId: "w", projectId: null }, "u"),
    ).toBeNull();
  });

  it("knows text from binary", () => {
    expect(isTextType("application/json; charset=utf-8")).toBe(true);
    expect(isTextType("application/vnd.api+json")).toBe(true);
    expect(isTextType("image/png")).toBe(false);
  });
});
