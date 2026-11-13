import { describe, expect, it } from "bun:test";
import { BaryntError, METHODS, Plugin } from "@barynt/plugin-sdk";
import { createTestHost, loadPlugin } from "@barynt/plugin-sdk/testing";
import { BRIDGE_METHODS } from "@/lib/plugins/bridge";

// The plugin SDK (BARY-146), on its own test host — no Barynt, no DOM.

describe("plugin SDK", () => {
  it("offers exactly the host bridge's methods", () => {
    expect([...METHODS].sort() as string[]).toEqual(
      Object.keys(BRIDGE_METHODS).sort(),
    );
  });

  it("calls Barynt through the host, typed", async () => {
    class Reader extends Plugin {
      count = 0;
      async onload() {
        const { issues } = await this.api.issues.list({ take: 5 });
        this.count = issues.length;
        await this.api.comments.create("WEB-1", "Hi");
        await this.api.issues.update("WEB-1", { status: "done" });
      }
    }
    const host = createTestHost({
      handlers: {
        "issues.list": () => ({ issues: [], nextCursor: null }),
        "comments.create": () => ({
          id: "c1",
          issueId: "i1",
          body: "Hi",
          created: "",
        }),
        "issues.update": ({ id }) => ({ id }),
      },
    });
    const { plugin } = await loadPlugin(Reader, host);
    expect(plugin.count).toBe(0);
    expect(host.calls).toEqual([
      { method: "issues.list", params: { take: 5 } },
      { method: "comments.create", params: { issueId: "WEB-1", body: "Hi" } },
      { method: "issues.update", params: { status: "done", id: "WEB-1" } },
    ]);
  });

  it("turns a refusal into a BaryntError with its code", async () => {
    class Writer extends Plugin {
      error: unknown;
      async onload() {
        try {
          await this.api.storage.set("k", 1);
        } catch (error) {
          this.error = error;
        }
      }
    }
    const { plugin } = await loadPlugin(Writer);
    expect(plugin.error).toBeInstanceOf(BaryntError);
    expect((plugin.error as BaryntError).code).toBe("capability_not_confirmed");
  });

  it("draws a project view only in its own frame", async () => {
    const drawn: string[] = [];
    class Views extends Plugin {
      onload() {
        for (const id of ["timeline", "calendar"])
          this.registerProjectView({ id, render: () => void drawn.push(id) });
      }
    }
    await loadPlugin(
      Views,
      createTestHost({
        context: { slot: { kind: "projectView", id: "calendar" } },
      }),
    );
    expect(drawn).toEqual(["calendar"]);
  });

  it("undoes what was registered on unload, after the plugin's own", async () => {
    const order: string[] = [];
    const target = new EventTarget() as unknown as HTMLElement;
    let clicks = 0;
    class Tidy extends Plugin {
      onload() {
        this.register(() => order.push("first"));
        this.register(() => order.push("second"));
        this.registerDomEvent(target, "click", () => {
          clicks += 1;
        });
        this.registerProjectView({
          id: "main",
          render: () => () => order.push("view"),
        });
      }
      onunload() {
        order.push("own");
      }
    }
    const { unload } = await loadPlugin(Tidy);
    target.dispatchEvent(new Event("click"));
    await Promise.resolve();
    unload();
    target.dispatchEvent(new Event("click"));
    expect(clicks).toBe(1);
    expect(order).toEqual(["own", "view", "second", "first"]);
  });

  it("cleans up even when the plugin defines no onunload", async () => {
    let cleaned = false;
    class Minimal extends Plugin {
      onload() {
        this.register(() => {
          cleaned = true;
        });
      }
    }
    const { unload } = await loadPlugin(Minimal);
    unload();
    expect(cleaned).toBe(true);
  });

  it("loads its settings through the host", async () => {
    class Configured extends Plugin {
      zoom = 0;
      async onload() {
        this.zoom = (await this.loadSettings<{ zoom: number }>()).zoom;
      }
    }
    const { plugin } = await loadPlugin(
      Configured,
      createTestHost({ handlers: { "settings.get": () => ({ zoom: 3 }) } }),
    );
    expect(plugin.zoom).toBe(3);
  });

  it("fetches through Barynt and reads the answer", async () => {
    class Remote extends Plugin {
      items: unknown;
      async onload() {
        const res = await this.api.net.fetch("https://api.acme.example/items");
        this.items = res.ok ? res.json() : null;
      }
    }
    const host = createTestHost({
      handlers: {
        "net.fetch": () => ({
          status: 200,
          headers: { "content-type": "application/json" },
          text: "[1,2]",
        }),
      },
    });
    const { plugin } = await loadPlugin(Remote, host);
    expect(plugin.items).toEqual([1, 2]);
    expect(host.calls[0]).toEqual({
      method: "net.fetch",
      params: { url: "https://api.acme.example/items" },
    });
  });

  it("draws a page only in its own frame, and not as a view", async () => {
    const drawn: string[] = [];
    class Pages extends Plugin {
      onload() {
        this.registerProjectView({
          id: "roadmap",
          render: () => void drawn.push("view"),
        });
        this.registerPage({
          id: "roadmap",
          render: () => void drawn.push("page"),
        });
      }
    }
    await loadPlugin(
      Pages,
      createTestHost({ context: { slot: { kind: "page", id: "roadmap" } } }),
    );
    expect(drawn).toEqual(["page"]);
  });

  it("draws a widget or its settings page only in its own frame", async () => {
    const drawn: string[] = [];
    class All extends Plugin {
      onload() {
        this.registerWidget({
          id: "w",
          render: () => void drawn.push("widget"),
        });
        this.registerSettings({ render: () => void drawn.push("settings") });
        this.registerProjectView({
          id: "w",
          render: () => void drawn.push("view"),
        });
      }
    }
    await loadPlugin(
      All,
      createTestHost({ context: { slot: { kind: "widget", id: "w" } } }),
    );
    await loadPlugin(
      All,
      createTestHost({
        context: { slot: { kind: "settings", id: "settings" } },
      }),
    );
    // Its part below Barynt's form (BARY-204) is drawn by the same call.
    await loadPlugin(
      All,
      createTestHost({
        context: { slot: { kind: "settings", id: "section" } },
      }),
    );
    expect(drawn).toEqual(["widget", "settings", "settings"]);
  });

  it("saves its settings through the host", async () => {
    class Saver extends Plugin {
      async onload() {
        await this.api.settings.set({ zoom: 2 });
      }
    }
    const host = createTestHost({ handlers: { "settings.set": () => null } });
    await loadPlugin(Saver, host);
    expect(host.calls).toEqual([
      { method: "settings.set", params: { values: { zoom: 2 } } },
    ]);
  });
});
