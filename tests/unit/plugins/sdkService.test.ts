import { describe, expect, it, mock } from "bun:test";
import { createHmac } from "node:crypto";
import {
  BaryntApiError,
  createService,
  type Installation,
  sign,
} from "@barynt/plugin-sdk/service";

// The server side of a plugin (BARY-214): what a maker's server does with
// Barynt's messages, as `createService` does it.

const SECRET = "installation-secret";

function message(
  event: string,
  data: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    event,
    timestamp: Date.now(),
    workspaceId: "ws-1",
    projectId: null,
    actor: null,
    via: null,
    data,
    ...extra,
  });
}

function request(
  body: string,
  opts: { secret?: string; delivery?: string; at?: number } = {},
) {
  const ts = String(opts.at ?? Date.now());
  return new Request("https://ci.acme.dev/barynt", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-barynt-timestamp": ts,
      "x-barynt-signature": createHmac("sha256", opts.secret ?? SECRET)
        .update(`${ts}.${body}`)
        .digest("hex"),
      "x-barynt-delivery": opts.delivery ?? crypto.randomUUID(),
      "x-barynt-installation": "act-1",
    },
    body,
  });
}

const installed = message("app.installed", {
  installationId: "act-1",
  pluginId: "ci-bridge",
  baryntUrl: "https://barynt.acme.dev/",
  secret: SECRET,
  token: "bpa_app",
  botUserId: "bot-1",
});

describe("sign()", () => {
  it("signs like Barynt: hex HMAC-SHA256 over <timestamp>.<body>", async () => {
    expect(await sign("s", "1000", '{"a":1}')).toBe(
      createHmac("sha256", "s").update('1000.{"a":1}').digest("hex"),
    );
  });
});

describe("createService()", () => {
  it("keeps an installation from app.installed and checks what follows by it", async () => {
    const service = createService();
    const seen: string[] = [];
    service.on("issue.created", (e) => {
      seen.push(String(e.data.ref));
    });

    expect((await service.fetch(request(installed))).status).toBe(204);
    expect(await service.store.get("act-1")).toMatchObject({
      pluginId: "ci-bridge",
      token: "bpa_app",
      workspaceId: "ws-1",
    });

    const ok = await service.fetch(
      request(message("issue.created", { ref: "WEB-1" })),
    );
    expect(ok.status).toBe(204);
    expect(seen).toEqual(["WEB-1"]);

    // Someone else's signature, an old message: refused, not handled.
    const forged = await service.fetch(
      request(message("issue.created", { ref: "WEB-2" }), { secret: "nope" }),
    );
    expect(forged.status).toBe(401);
    const stale = await service.fetch(
      request(message("issue.created", { ref: "WEB-3" }), {
        at: Date.now() - 10 * 60_000,
      }),
    );
    expect(stale.status).toBe(401);
    expect(seen).toEqual(["WEB-1"]);
  });

  it("refuses an event for an installation it doesn't know", async () => {
    const res = await createService().fetch(
      request(message("issue.created", { ref: "WEB-1" })),
    );
    expect(res.status).toBe(401);
  });

  it("handles a delivery once, however often Barynt retries it", async () => {
    const service = createService();
    await service.fetch(request(installed));
    const handler = mock();
    service.on("*", handler);
    const body = message("issue.created", { ref: "WEB-1" });
    await service.fetch(request(body, { delivery: "d-1" }));
    await service.fetch(request(body, { delivery: "d-1" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("answers 500 when a handler fails, so Barynt tries again", async () => {
    const service = createService();
    await service.fetch(request(installed));
    let calls = 0;
    service.on("issue.created", () => {
      calls++;
      if (calls === 1) throw new Error("db down");
    });
    const body = message("issue.created", { ref: "WEB-1" });
    expect(
      (await service.fetch(request(body, { delivery: "d-1" }))).status,
    ).toBe(500);
    expect(
      (await service.fetch(request(body, { delivery: "d-1" }))).status,
    ).toBe(204);
    expect(calls).toBe(2);
  });

  it("forgets the installation with app.uninstalled", async () => {
    const service = createService();
    await service.fetch(request(installed));
    await service.fetch(
      request(message("app.uninstalled", { installationId: "act-1" })),
    );
    expect(await service.store.get("act-1")).toBeUndefined();
  });

  it("acts for the person when Barynt sent a token, else as its app", async () => {
    const calls: { url: string; auth: string | null; body: unknown }[] = [];
    const fakeFetch = mock(async (url: URL | string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json({ data: { id: "c-1" } }, { status: 201 });
    }) as unknown as typeof fetch;
    const service = createService({ fetch: fakeFetch });
    service.on("issue.status_changed", async (e, { barynt, app }) => {
      await barynt.comments.create(String(e.data.id), "for the person");
      await app.comments.create(String(e.data.id), "as the app");
    });
    await service.fetch(request(installed));
    await service.fetch(
      request(
        message(
          "issue.status_changed",
          { id: "i-1" },
          {
            acting: {
              token: "bpt_person",
              userId: "u-1",
              expiresAt: new Date().toISOString(),
            },
          },
        ),
      ),
    );
    expect(calls).toEqual([
      {
        url: "https://barynt.acme.dev/api/v1/issues/i-1/comments",
        auth: "Bearer bpt_person",
        body: { body: "for the person" },
      },
      {
        url: "https://barynt.acme.dev/api/v1/issues/i-1/comments",
        auth: "Bearer bpa_app",
        body: { body: "as the app" },
      },
    ]);
  });

  it("throws BaryntApiError when Barynt says no", async () => {
    const service = createService({
      fetch: (async () =>
        Response.json(
          { error: "forbidden" },
          { status: 403 },
        )) as unknown as typeof fetch,
    });
    let error: unknown;
    service.on("issue.created", async (_e, { app }) => {
      try {
        await app.issues.get("WEB-1");
      } catch (e) {
        error = e;
      }
    });
    const installation: Installation = {
      id: "act-1",
      pluginId: "ci-bridge",
      workspaceId: "ws-1",
      projectId: null,
      secret: SECRET,
      token: "bpa_app",
      baryntUrl: "https://barynt.acme.dev/",
    };
    await service.simulate(
      {
        event: "issue.created",
        workspaceId: "ws-1",
        projectId: null,
        actor: null,
        via: null,
        data: { ref: "WEB-1" },
      },
      installation,
    );
    expect(error).toBeInstanceOf(BaryntApiError);
    expect((error as BaryntApiError).status).toBe(403);
  });
});
