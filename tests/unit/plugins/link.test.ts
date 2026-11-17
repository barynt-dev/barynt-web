import { describe, expect, it } from "bun:test";
import {
  findIssueRefs,
  readLinkFindings,
  ruleAction,
} from "@/lib/plugins/link";

// What Barynt reads of a GitLab or GitHub call to file it under issues
// (BARY-216), and where it finds their keys.

const AT = new Date("2026-11-17T10:00:00Z");

describe("findIssueRefs", () => {
  it("finds keys as titles and branches write them, each once", () => {
    expect(
      findIssueRefs(
        ["web-42-fix-login", "Fix login (WEB-42, WEB_7)", "feature/ops-3"],
        ["WEB", "OPS"],
      ),
    ).toEqual([
      { prefix: "WEB", key: 42 },
      { prefix: "WEB", key: 7 },
      { prefix: "OPS", key: 3 },
    ]);
  });

  it("skips prefixes it doesn't know and keys inside other words", () => {
    expect(findIssueRefs(["XWEB-42 sha256-1 FOO-1"], ["WEB"])).toEqual([]);
    expect(findIssueRefs(["WEB-42"], [])).toEqual([]);
  });
});

describe("readLinkFindings — GitLab", () => {
  it("reads a merge request, opened or merged", () => {
    const body = {
      user: { name: "Ada" },
      object_attributes: {
        iid: 412,
        title: "Fix the login",
        source_branch: "ada/web-42-login",
        url: "https://gitlab.acme.dev/web/-/merge_requests/412",
        state: "opened",
        action: "open",
      },
    };
    const [opened] = readLinkFindings("gitlab", "merge_request", body, AT);
    expect(opened.record).toMatchObject({
      key: "mr:412",
      kind: "merge_request",
      number: "!412",
      state: "opened",
      branch: "ada/web-42-login",
      author: "Ada",
      at: AT.toISOString(),
    });
    expect(opened.opened).toBe(true);

    const merged = readLinkFindings(
      "gitlab",
      "merge_request",
      {
        ...body,
        object_attributes: { ...body.object_attributes, action: "merge" },
      },
      AT,
    )[0];
    expect(merged.record.state).toBe("merged");
    expect(merged.opened).toBe(false);
  });

  it("keeps one pipeline per branch and files a push's commits", () => {
    const [pipeline] = readLinkFindings(
      "gitlab",
      "pipeline",
      { object_attributes: { id: 9, ref: "web-42", status: "failed" } },
      AT,
    );
    expect(pipeline.record).toMatchObject({
      key: "pipeline:web-42",
      state: "failed",
    });

    const push = readLinkFindings(
      "gitlab",
      "push",
      {
        ref: "refs/heads/main",
        commits: [{ id: "abcdef1234567890", message: "WEB-42: fix\n\nmore" }],
      },
      AT,
    );
    expect(push[0].record).toMatchObject({
      key: "commit:abcdef123456",
      number: "abcdef12",
      title: "WEB-42: fix",
      branch: "main",
    });
  });
});

describe("readLinkFindings — GitHub", () => {
  it("reads a pull request and a workflow run", () => {
    const [pr] = readLinkFindings(
      "github",
      "pull_request",
      {
        action: "closed",
        pull_request: {
          number: 7,
          title: "Login",
          merged: true,
          state: "closed",
          head: { ref: "web-42" },
          user: { login: "ada" },
        },
      },
      AT,
    );
    expect(pr.record).toMatchObject({ key: "mr:7", state: "merged" });

    const [run] = readLinkFindings(
      "github",
      "workflow_run",
      {
        workflow_run: {
          run_number: 3,
          head_branch: "web-42",
          conclusion: "failure",
        },
      },
      AT,
    );
    expect(run.record).toMatchObject({
      key: "pipeline:web-42",
      state: "failed",
    });
  });

  it("reads nothing of an event it doesn't know, or a generic hook", () => {
    expect(readLinkFindings("github", "star", {}, AT)).toEqual([]);
    expect(readLinkFindings("generic", "push", { commits: [] }, AT)).toEqual(
      [],
    );
  });
});

describe("ruleAction", () => {
  const mr = (state: string, opened = false) => ({
    record: {
      key: "mr:1",
      kind: "merge_request" as const,
      number: "!1",
      title: "",
      state,
      url: null,
      branch: null,
      author: null,
      at: "",
    },
    texts: [],
    opened,
  });

  it("completes on a merge, comments on an opening — nothing else", () => {
    expect(ruleAction("merged_to_done", mr("merged"))).toBe("complete");
    expect(ruleAction("merged_to_done", mr("opened"))).toBeNull();
    expect(ruleAction("comment_on_open", mr("opened", true))).toBe("comment");
    expect(ruleAction("comment_on_open", mr("opened"))).toBeNull();
  });
});
