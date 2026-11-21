import { beforeEach, describe, expect, it, mock } from "bun:test";

// The first screenshot of a plugin that isn't installed (BARY-237): who may
// ask, what comes back, and what doesn't.

const getSession = mock(async () => ({ userId: "u1" }) as unknown);
const hasPermission = mock(async () => true);
const listedPreview = mock(
  async (_id: string) =>
    ({ file: "preview-1.webp", content: new Uint8Array([1, 2, 3]) }) as {
      file: string;
      content: Uint8Array;
    } | null,
);

mock.module("@/lib/session", () => ({ getSession }));
mock.module("@/lib/permissions", () => ({
  hasPermission,
  PLATFORM: { type: "platform" },
}));
mock.module("@/features/plugins/directory", () => ({ listedPreview }));

import { GET } from "@/app/api/plugin-listed-previews/[pluginId]/route";

const ask = (pluginId: string) =>
  GET(new Request("http://localhost/x"), {
    params: Promise.resolve({ pluginId }),
  });

describe("GET /api/plugin-listed-previews/[pluginId]", () => {
  beforeEach(() => {
    getSession.mockClear();
    hasPermission.mockClear();
    listedPreview.mockClear();
    getSession.mockResolvedValue({ userId: "u1" });
    hasPermission.mockResolvedValue(true);
  });

  it("sends the screenshot as the image it is, locked down", async () => {
    const res = await ask("github");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("knows a PNG", async () => {
    listedPreview.mockResolvedValueOnce({
      file: "preview-2.png",
      content: new Uint8Array([9]),
    });
    expect((await ask("github")).headers.get("Content-Type")).toBe("image/png");
  });

  it("wants a signed-in person", async () => {
    getSession.mockResolvedValueOnce(null);
    expect((await ask("github")).status).toBe(401);
    expect(listedPreview).not.toHaveBeenCalled();
  });

  it("loads nothing for anyone who may not install plugins", async () => {
    hasPermission.mockResolvedValueOnce(false);
    expect((await ask("github")).status).toBe(404);
    expect(listedPreview).not.toHaveBeenCalled();
  });

  it("is a 404 without a screenshot, and for an id that isn't one", async () => {
    listedPreview.mockResolvedValueOnce(null);
    expect((await ask("github")).status).toBe(404);
    for (const bad of ["../etc", "A", "x", "gi hub"])
      expect((await ask(bad)).status).toBe(404);
    expect(listedPreview).toHaveBeenCalledTimes(1);
  });
});
