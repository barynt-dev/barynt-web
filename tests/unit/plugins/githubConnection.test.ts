import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  APP_EVENTS,
  appJwt,
  appManifest,
  appPermissionsUrl,
  isChosen,
  isPublicBase,
  manageInstallationUrl,
  missingGrants,
  readPrivateKey,
  repositoryOfRequest,
} from "@/lib/github/app";
import { routeTargets } from "@/lib/github/route";
import {
  openChoice,
  openState,
  STATE_TTL_SECONDS,
  sealChoice,
  sealState,
} from "@/lib/github/state";
import { validateManifest } from "@/lib/plugins/manifest";
import { checkSettings, repositoryList } from "@/lib/plugins/settings";

// Connecting workspaces and projects to GitHub through the instance's
// GitHub App (BARY-238): the pure parts.

const saved = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters!";
});
afterAll(() => {
  process.env.AUTH_SECRET = saved;
});

const github = {
  id: "github",
  name: "GitHub",
  version: "1.0.0",
  minBaryntVersion: "0.1.0",
  author: "Barynt",
  description: { short: "Pull requests on issues." },
  license: "MIT",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["issues:read"],
  network: ["api.github.com"],
  contributes: {
    connections: [{ id: "github", title: "GitHub", provider: "github" }],
    settings: [{ key: "repositories", type: "repositories", label: "Repos" }],
  },
};

function errors(input: unknown) {
  const r = validateManifest(input);
  return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`);
}

describe("manifest: connections and repositories", () => {
  it("accepts a GitHub connection with a repositories setting", () => {
    expect(errors(github)).toEqual([]);
  });

  it("needs api.github.com in network", () => {
    expect(errors({ ...github, network: [] }).join()).toContain(
      "api.github.com must be in network",
    );
  });

  it("refuses a repositories setting without a connection", () => {
    const { connections: _, ...contributes } = github.contributes;
    expect(errors({ ...github, contributes }).join()).toContain(
      "needs a connection",
    );
  });

  it("isn't for a declarative plugin", () => {
    expect(
      errors({
        ...github,
        kind: "declarative",
        network: [],
        contributes: {
          connections: github.contributes.connections,
        },
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("repositories setting", () => {
  const spec = [{ key: "repositories", type: "repositories" as const }];

  it("keeps a list, unique without case", () => {
    const r = checkSettings(spec, {
      repositories: ["acme/web", "ACME/web", " acme/api "],
    });
    expect(r).toEqual({
      ok: true,
      values: { repositories: ["acme/web", "acme/api"] },
    });
  });

  it("takes text one per line, as the old field had it", () => {
    expect(
      checkSettings(spec, { repositories: "acme/web\nacme/api\n" }),
    ).toEqual({ ok: true, values: { repositories: ["acme/web", "acme/api"] } });
  });

  it("refuses what isn't a full name", () => {
    expect(checkSettings(spec, { repositories: ["acme"] }).ok).toBe(false);
    expect(checkSettings(spec, { repositories: ["a/b/c"] }).ok).toBe(false);
  });

  it("leaves an empty list out", () => {
    expect(checkSettings(spec, { repositories: [] })).toEqual({
      ok: true,
      values: {},
    });
  });

  it("reads a stored value of either shape", () => {
    expect(repositoryList("acme/web, acme/api")).toEqual([
      "acme/web",
      "acme/api",
    ]);
    expect(repositoryList(["acme/web", 3, "nope"])).toEqual(["acme/web"]);
    expect(repositoryList(undefined)).toEqual([]);
  });
});

describe("GitHub App", () => {
  it("signs its JWT with the private key, for ten minutes at most", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const jwt = appJwt("123", pem, 1_000_000);
    const [header, payload, signature] = jwt.split(".");
    const verify = createVerify("RSA-SHA256");
    verify.update(`${header}.${payload}`);
    expect(verify.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(
      true,
    );
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims).toEqual({ iat: 999_940, exp: 1_000_540, iss: "123" });
  });

  it("reads a key given on one line", () => {
    expect(readPrivateKey("-----BEGIN-----\\nabc\\n-----END-----")).toBe(
      "-----BEGIN-----\nabc\n-----END-----",
    );
  });

  it("asks for what the plugin needs, and comes back to Barynt", () => {
    const m = appManifest({
      baseUrl: "https://issues.acme.dev/",
      name: "Barynt",
      public: true,
    });
    expect(m.hook_attributes?.url).toBe(
      "https://issues.acme.dev/api/github/webhook",
    );
    expect(m.redirect_url).toBe(
      "https://issues.acme.dev/api/github/app/created",
    );
    expect(m.callback_urls).toEqual([
      "https://issues.acme.dev/api/github/callback",
    ]);
    expect(m.request_oauth_on_install).toBe(true);
    expect(m.default_permissions.contents).toBe("write");
    expect(m.default_events).toContain("pull_request");
  });

  it("leaves the webhook out where GitHub can't reach Barynt", () => {
    const m = appManifest({
      baseUrl: "http://localhost:3000",
      name: "Barynt",
      public: true,
    });
    expect("hook_attributes" in m).toBe(false);
    expect("default_events" in m).toBe(false);
    expect(m.callback_urls).toEqual([
      "http://localhost:3000/api/github/callback",
    ]);
  });

  it("tells a public address from a local one", () => {
    for (const url of [
      "https://issues.acme.dev",
      "https://203.0.113.7",
      "https://[2001:db8::1]",
    ])
      expect(isPublicBase(url)).toBe(true);
    for (const url of [
      "http://localhost:3000",
      "http://app.localhost",
      "http://127.0.0.1:3000",
      "http://192.168.1.20",
      "http://10.0.0.5",
      "http://172.20.0.3",
      "http://barynt",
      "http://barynt.local",
      "http://[::1]:3000",
      "not a url",
    ])
      expect(isPublicBase(url)).toBe(false);
  });

  it("links to an installation's settings on GitHub", () => {
    expect(
      manageInstallationUrl({
        id: "7",
        account: "acme",
        accountType: "Organization",
      }),
    ).toBe("https://github.com/organizations/acme/settings/installations/7");
    expect(
      manageInstallationUrl({ id: "7", account: "ada", accountType: "User" }),
    ).toBe("https://github.com/settings/installations/7");
  });
});

describe("which request may use an installation's token", () => {
  const url = (s: string) => new URL(s);

  it("names the repository of a /repos/ request", () => {
    expect(
      repositoryOfRequest(
        url("https://api.github.com/repos/acme/web/git/refs"),
      ),
    ).toBe("acme/web");
    expect(
      repositoryOfRequest(url("https://api.github.com/repos/acme/web")),
    ).toBe("acme/web");
  });

  it("names none for anything else", () => {
    expect(repositoryOfRequest(url("https://api.github.com/user"))).toBeNull();
    expect(
      repositoryOfRequest(url("https://api.github.com/orgs/acme/repos")),
    ).toBeNull();
    expect(
      repositoryOfRequest(url("https://api.github.com/graphql")),
    ).toBeNull();
    expect(
      repositoryOfRequest(url("https://gitlab.com/repos/acme/web")),
    ).toBeNull();
  });

  it("compares names as GitHub does, without case", () => {
    expect(isChosen("Acme/Web", ["acme/web"])).toBe(true);
    expect(isChosen("acme/api", ["acme/web"])).toBe(false);
  });
});

describe("where the app's webhook goes", () => {
  const activations = [
    { id: "a1", workspaceId: "w1", projectId: "p1", chosen: ["acme/web"] },
    { id: "a2", workspaceId: "w1", projectId: "p2", chosen: ["acme/api"] },
    { id: "a3", workspaceId: "w2", projectId: "p3", chosen: ["acme/web"] },
    { id: "a4", workspaceId: "w1", projectId: null, chosen: ["acme/web"] },
  ];

  it("reaches the workspace's projects that chose the repository", () => {
    expect(
      routeTargets("acme/web", ["ws:w1"], activations).map((a) => a.id),
    ).toEqual(["a1"]);
  });

  it("reaches a project connected itself, and no other workspace", () => {
    expect(
      routeTargets("ACME/web", ["pr:p3"], activations).map((a) => a.id),
    ).toEqual(["a3"]);
  });

  it("reaches nobody who didn't choose it", () => {
    expect(routeTargets("acme/other", ["ws:w1", "ws:w2"], activations)).toEqual(
      [],
    );
  });
});

describe("the state GitHub hands back", () => {
  const connect = {
    kind: "connect" as const,
    userId: "u1",
    pluginId: "github",
    workspaceId: "w1",
    projectId: "p1",
    back: "/w1/project/web/settings/plugins/github",
  };

  it("opens for the person who started it, while fresh", () => {
    const sealed = sealState(connect, 1000);
    expect(openState(sealed, "connect", "u1", 1000)).toMatchObject(connect);
    expect(
      openState(sealed, "connect", "u1", 1000 + STATE_TTL_SECONDS + 1),
    ).toBeNull();
  });

  it("opens for nobody else, and not as another kind", () => {
    const sealed = sealState(connect, 1000);
    expect(openState(sealed, "connect", "u2", 1000)).toBeNull();
    expect(openState(sealed, "app", "u1", 1000)).toBeNull();
    expect(openState("v1.made.up.value", "connect", "u1", 1000)).toBeNull();
  });

  it("only sends back to a path of Barynt", () => {
    const sealed = sealState({ ...connect, back: "//evil.example" }, 1000);
    expect(openState(sealed, "connect", "u1", 1000)).toBeNull();
  });

  it("keeps the installations to choose from briefly", () => {
    const choice = {
      userId: "u1",
      pluginId: "github",
      scopeKey: "pr:p1",
      installations: [
        { id: "7", account: "acme", accountType: "Organization", avatar: null },
      ],
    };
    const sealed = sealChoice(choice, 1000);
    expect(openChoice(sealed, 1000)).toMatchObject(choice);
    expect(openChoice(sealed, 1000 + 11 * 60)).toBeNull();
  });
});

describe("what the app needs (BARY-238)", () => {
  it("names what an app made before lacks, and a permission only read", () => {
    const missing = missingGrants({
      permissions: {
        contents: "write",
        pull_requests: "read",
        checks: "read",
        metadata: "read",
      },
      events: ["push", "pull_request"],
    });
    expect(missing.permissions).toEqual([
      "pull_requests",
      "actions",
      "deployments",
    ]);
    expect(missing.events).toContain("deployment_status");
  });

  it("is content with everything, or more", () => {
    expect(
      missingGrants({
        permissions: {
          contents: "write",
          pull_requests: "write",
          checks: "write",
          actions: "write",
          deployments: "read",
          metadata: "read",
          issues: "write",
        },
        events: [...APP_EVENTS, "issues"],
      }),
    ).toEqual({ permissions: [], events: [] });
  });

  it("leaves events out for an installation, which has none to set", () => {
    expect(missingGrants({ permissions: {} }).events).toEqual([]);
  });

  it("links the app's permissions under its owner", () => {
    expect(
      appPermissionsUrl("barynt-acme", { login: "acme", type: "Organization" }),
    ).toBe(
      "https://github.com/organizations/acme/settings/apps/barynt-acme/permissions",
    );
    expect(
      appPermissionsUrl("barynt-ada", { login: "ada", type: "User" }),
    ).toBe("https://github.com/settings/apps/barynt-ada/permissions");
  });
});
