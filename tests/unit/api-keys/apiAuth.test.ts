import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindUnique = mock();
const mockUpdateMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    apiKey: { findUnique: mockFindUnique, updateMany: mockUpdateMany },
    plugin: {
      findFirst: async () => ({ manifest: { name: "GitLab" } }),
    },
  },
}));

import { type ApiAuthResult, hasScope, resolveApiUser } from "@/lib/api-auth";
import { actingScope, currentPlugin } from "@/lib/webhooks/source";

const TOKEN = "bry_abc123";
const HASH = createHash("sha256").update(TOKEN).digest("hex");

const ACTIVE_KEY = {
  id: "k-1",
  userId: "u-1",
  scopes: ["issues:read"],
  revokedAt: null,
  expiresAt: null,
  user: { deactivatedAt: null },
};

function request(authorization?: string): Request {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  return new Request("https://example.com/api/v1/workspaces", { headers });
}

function reset() {
  mockFindUnique.mockReset();
  mockUpdateMany.mockReset();
  mockFindUnique.mockResolvedValue(ACTIVE_KEY);
  mockUpdateMany.mockResolvedValue({ count: 1 });
}

describe("resolveApiUser()", () => {
  beforeEach(reset);

  it("resolves a valid Bearer token", async () => {
    const result = await resolveApiUser(request(`Bearer ${TOKEN}`));
    expect(result).toEqual({
      userId: "u-1",
      keyId: "k-1",
      scopes: ["issues:read"],
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: HASH },
      select: expect.anything(),
    });
  });

  it("rejects a missing header", async () => {
    expect(await resolveApiUser(request())).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a malformed header", async () => {
    expect(await resolveApiUser(request("Token abc"))).toBeNull();
    expect(await resolveApiUser(request("Bearer"))).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a token without the bry_ prefix", async () => {
    expect(await resolveApiUser(request("Bearer sk_notours"))).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("takes a plugin's app token too (BARY-213)", async () => {
    const app = "bpa_plugin-token";
    mockFindUnique.mockResolvedValue({ ...ACTIVE_KEY, userId: "bot-1" });
    const result = await resolveApiUser(request(`Bearer ${app}`));
    expect(result?.userId).toBe("bot-1");
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash("sha256").update(app).digest("hex") },
      select: expect.anything(),
    });
  });

  it("acts for a person through a plugin — and the caller knows (BARY-214)", async () => {
    const actingToken = "bpt_for-a-person";
    mockFindUnique.mockResolvedValue({
      ...ACTIVE_KEY,
      userId: "person-1",
      activation: {
        pluginId: "gitlab",
        workspaceId: "ws-1",
        projectId: null,
        capabilities: ["comments:write"],
        enabled: true,
      },
    });
    const result = await resolveApiUser(request(`Bearer ${actingToken}`));
    expect(result?.userId).toBe("person-1");
    // Carried on into the route that awaited it.
    expect(currentPlugin()).toEqual({ id: "gitlab", name: "GitLab" });
    expect(actingScope()).toEqual({
      workspaceId: "ws-1",
      projectId: null,
      capabilities: ["comments:write"],
    });
  });

  it("refuses an acting token whose plugin is off", async () => {
    mockFindUnique.mockResolvedValue({
      ...ACTIVE_KEY,
      activation: {
        pluginId: "gitlab",
        workspaceId: "ws-1",
        projectId: null,
        capabilities: [],
        enabled: false,
      },
    });
    expect(await resolveApiUser(request("Bearer bpt_x"))).toBeNull();
  });

  it("rejects an unknown hash", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolveApiUser(request(`Bearer ${TOKEN}`))).toBeNull();
  });

  it("rejects a revoked key", async () => {
    mockFindUnique.mockResolvedValue({ ...ACTIVE_KEY, revokedAt: new Date() });
    expect(await resolveApiUser(request(`Bearer ${TOKEN}`))).toBeNull();
  });

  it("rejects an expired key", async () => {
    mockFindUnique.mockResolvedValue({
      ...ACTIVE_KEY,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await resolveApiUser(request(`Bearer ${TOKEN}`))).toBeNull();
  });

  it("accepts a key that expires in the future", async () => {
    mockFindUnique.mockResolvedValue({
      ...ACTIVE_KEY,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    expect(await resolveApiUser(request(`Bearer ${TOKEN}`))).not.toBeNull();
  });

  it("rejects a deactivated account", async () => {
    mockFindUnique.mockResolvedValue({
      ...ACTIVE_KEY,
      user: { deactivatedAt: new Date() },
    });
    expect(await resolveApiUser(request(`Bearer ${TOKEN}`))).toBeNull();
  });

  it("touches lastUsedAt, throttled to once per 5 minutes", async () => {
    await resolveApiUser(request(`Bearer ${TOKEN}`));
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "k-1",
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: expect.any(Date) } }],
      },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});

describe("hasScope()", () => {
  it("is true only for a scope the token actually carries", () => {
    const auth: ApiAuthResult = {
      userId: "u-1",
      keyId: "k-1",
      scopes: ["issues:read"],
    };
    expect(hasScope(auth, "issues:read")).toBe(true);
    expect(hasScope(auth, "issues:write")).toBe(false);
  });
});
