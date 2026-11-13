import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createTestHost, loadPlugin } from "@barynt/plugin-sdk/testing";
import GitLabMergeRequests from "../../../scripts/plugins/demo-plugins/gitlab-mrs";

// The GitLab example from the plugin docs (BARY-147), on the SDK's test
// host. Bun has no DOM, so a minimal one stands in: what the plugin calls
// (createElement, append, replaceChildren, textContent, listeners).

class FakeElement {
  children: FakeElement[] = [];
  className = "";
  textContent = "";
  href = "";
  target = "";
  rel = "";
  disabled = false;
  #listeners = new Map<string, Set<(e: unknown) => unknown>>();
  constructor(readonly tagName: string) {}
  append(...nodes: FakeElement[]) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: FakeElement[]) {
    this.children = nodes;
  }
  addEventListener(type: string, fn: (e: unknown) => unknown) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type)?.add(fn);
  }
  removeEventListener(type: string, fn: (e: unknown) => unknown) {
    this.#listeners.get(type)?.delete(fn);
  }
  async click() {
    for (const fn of this.#listeners.get("click") ?? []) await fn({});
  }
  /** Every element below, depth first. */
  all(): FakeElement[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  text(): string {
    return [this.textContent, ...this.children.map((c) => c.text())].join(" ");
  }
}

const g = globalThis as { document?: unknown };
beforeAll(() => {
  g.document = { createElement: (tag: string) => new FakeElement(tag) };
});
afterAll(() => {
  delete g.document;
});

const mergeRequest = {
  iid: 42,
  title: "WEB-7: empty states",
  web_url: "https://gitlab.com/acme/web/-/merge_requests/42",
  source_branch: "empty-states",
  author: { name: "Ada" },
};
const issue = { id: "i7", ref: "WEB-7", title: "Empty states" };

type Handlers = NonNullable<
  NonNullable<Parameters<typeof createTestHost>[0]>["handlers"]
>;

function setUp(over: Handlers = {}) {
  const root = new FakeElement("div");
  const stored: Record<string, unknown> = {};
  const host = createTestHost({
    root: root as unknown as HTMLElement,
    context: { slot: { kind: "projectView", id: "merge-requests" } },
    handlers: {
      "settings.get": () => ({ gitlabProject: "acme/web" }),
      "net.fetch": () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        text: JSON.stringify([mergeRequest]),
      }),
      "issues.list": () => ({ issues: [issue as never], nextCursor: null }),
      "storage.get": ({ key }) => (stored[key] ?? null) as never,
      "storage.set": ({ key, value }) => {
        stored[key] = value;
        return null;
      },
      "comments.create": ({ issueId, body }) => ({
        id: "c1",
        issueId,
        body,
        created: "",
      }),
      ...over,
    },
  });
  return { root, host, stored };
}

describe("demo GitLab merge requests", () => {
  it("lists the configured project's merge requests", async () => {
    const { root, host } = setUp();
    const { unload } = await loadPlugin(GitLabMergeRequests, host);
    expect(
      host.calls.find((c) => c.method === "net.fetch")?.params,
    ).toMatchObject({
      url: "https://gitlab.com/api/v4/projects/acme%2Fweb/merge_requests?state=opened&per_page=50",
    });
    expect(root.text()).toContain("1 open merge requests");
    expect(root.text()).toContain("!42 WEB-7: empty states");
    const link = root.all().find((e) => e.tagName === "a");
    expect(link?.href).toBe(mergeRequest.web_url);
    expect(link?.rel).toBe("noopener noreferrer");
    unload();
  });

  it("links a merge request in the issue it mentions, once", async () => {
    const { root, host, stored } = setUp();
    const { unload } = await loadPlugin(GitLabMergeRequests, host);
    const button = root.all().find((e) => e.tagName === "button");
    expect(button?.textContent).toBe("Link in WEB-7");
    await button?.click();
    expect(
      host.calls.find((c) => c.method === "comments.create")?.params,
    ).toEqual({
      issueId: "i7",
      body: `Merge request: [!42 WEB-7: empty states](${mergeRequest.web_url})`,
    });
    expect(stored.linked).toEqual([42]);
    expect(button?.textContent).toBe("WEB-7 ✓");
    expect(button?.disabled).toBe(true);
    unload();
  });

  it("asks for the GitLab project while it isn't set", async () => {
    const { root, host } = setUp({
      "settings.get": () => ({ gitlabProject: null }),
    });
    await loadPlugin(GitLabMergeRequests, host);
    expect(root.text()).toContain("Set the GitLab project");
    expect(host.calls.some((c) => c.method === "net.fetch")).toBe(false);
  });

  it("points to the personal settings without a token", async () => {
    const { root, host } = setUp({
      "net.fetch": () => {
        throw new Error("credential_missing");
      },
    });
    await loadPlugin(GitLabMergeRequests, host);
    expect(root.text()).toContain("Keep your GitLab token");
  });

  it("says what GitLab answered when it isn't OK", async () => {
    const { root, host } = setUp({
      "net.fetch": () => ({ status: 401, headers: {}, text: "{}" }),
    });
    await loadPlugin(GitLabMergeRequests, host);
    expect(root.text()).toContain("GitLab answered 401.");
  });

  it("stops refreshing and removes its listeners on unload", async () => {
    const { host } = setUp();
    const { unload } = await loadPlugin(GitLabMergeRequests, host);
    const before = host.calls.length;
    unload();
    await new Promise((r) => setTimeout(r, 10));
    expect(host.calls.length).toBe(before);
  });
});
