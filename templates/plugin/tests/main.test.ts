import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Issue } from "@barynt/plugin-sdk";
import { createTestHost, loadPlugin } from "@barynt/plugin-sdk/testing";
import { Window } from "happy-dom";
import OpenIssues from "../src/main";
import { openIssues } from "../src/open";

// The plugin against the SDK's test host: what each call answers is said
// here, every call is recorded. happy-dom stands in for the frame's DOM.

const g = globalThis as { document?: unknown };
let window: Window;
beforeAll(() => {
  window = new Window();
  g.document = window.document;
});
afterAll(async () => {
  delete g.document;
  await window.happyDOM.close();
});

const issue = (ref: string, statusCategory: Issue["statusCategory"]) =>
  ({ id: ref, ref, title: `Title of ${ref}`, statusCategory }) as Issue;

describe("openIssues", () => {
  it("leaves out completed and canceled issues", () => {
    const all = [
      issue("WEB-1", "started"),
      issue("WEB-2", "completed"),
      issue("WEB-3", "canceled"),
      issue("WEB-4", null),
    ];
    expect(openIssues(all).map((i) => i.ref)).toEqual(["WEB-1", "WEB-4"]);
  });
});

describe("the view", () => {
  it("asks for the project's issues and lists the open ones", async () => {
    const root = document.createElement("div");
    const host = createTestHost({
      root: root as unknown as HTMLElement,
      context: { slot: { kind: "projectView", id: "open" } },
      handlers: {
        "issues.list": () => ({
          issues: [issue("WEB-1", "started"), issue("WEB-2", "completed")],
          nextCursor: null,
        }),
      },
    });
    await loadPlugin(OpenIssues, host);
    expect(host.calls).toEqual([
      { method: "issues.list", params: { take: 100 } },
    ]);
    expect(root.textContent).toBe("WEB-1 · Title of WEB-1");
  });
});
