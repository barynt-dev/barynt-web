// Demo GitLab Merge Requests (BARY-147): the example from the plugin docs,
// run for real. A project view with the open merge requests of a GitLab
// project and the issues they mention: a setting (the GitLab project), a
// personal token Barynt adds itself, `net.fetch`, reading issues, writing a
// comment, its own storage, and cleanup on unload.

import { BaryntError, type Issue, Plugin } from "@barynt/plugin-sdk";

interface MergeRequest {
  iid: number;
  title: string;
  web_url: string;
  source_branch: string;
  author: { name: string };
}

const el = (tag: string, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // never innerHTML with data
  return node;
};

export default class GitLabMergeRequests extends Plugin {
  async onload() {
    // Its own settings page (BARY-149): the GitLab project, checked against
    // GitLab before it's saved.
    this.registerSettings({ render: (root) => this.drawSettings(root) });
    this.registerProjectView({
      id: "merge-requests",
      render: async (root) => {
        await this.draw(root);
        // Refresh every 2 minutes; cleared by itself on unload.
        this.registerInterval(() => void this.draw(root), 120_000);
      },
    });
  }

  async drawSettings(root: HTMLElement) {
    const { gitlabProject } = await this.loadSettings<{
      gitlabProject: string | null;
    }>();
    const form = el("form", "mr-settings") as HTMLFormElement;
    const label = el("label", "mr-label", "GitLab project");
    const input = el("input", "mr-input") as HTMLInputElement;
    input.value = gitlabProject ?? "";
    input.placeholder = "acme/web";
    input.id = "gitlab-project";
    label.setAttribute("for", "gitlab-project");
    const status = el("p", "mr-status");
    const save = el("button", "mr-save", "Check and save") as HTMLButtonElement;
    save.type = "submit";
    form.append(label, input, status, save);
    this.registerDomEvent(form, "submit", async (event) => {
      event.preventDefault();
      const path = input.value.trim();
      save.disabled = true;
      status.textContent = "Checking with GitLab…";
      try {
        const res = await this.api.net.fetch(
          `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}`,
        );
        if (res.status === 404) {
          status.textContent = `GitLab doesn't know “${path}”.`;
          return;
        }
        const name = res.ok
          ? res.json<{ name_with_namespace: string }>().name_with_namespace
          : path;
        await this.api.settings.set({ gitlabProject: path });
        status.textContent = `Saved: ${name}.`;
      } catch (error) {
        status.textContent =
          error instanceof BaryntError && error.code === "credential_missing"
            ? "Keep your GitLab token in your personal settings → Plugins first."
            : error instanceof BaryntError && error.code === "forbidden"
              ? "Only project admins can change this."
              : String(error);
      } finally {
        save.disabled = false;
      }
    });
    root.replaceChildren(form);
  }

  async draw(root: HTMLElement) {
    const { gitlabProject } = await this.loadSettings<{
      gitlabProject: string | null;
    }>();
    if (!gitlabProject) {
      root.replaceChildren(
        el(
          "p",
          "mr-hint",
          "Set the GitLab project in the project settings → Plugins → GitLab Merge Requests.",
        ),
      );
      return;
    }

    let mergeRequests: MergeRequest[];
    try {
      const res = await this.api.net.fetch(
        `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlabProject)}/merge_requests?state=opened&per_page=50`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) {
        root.replaceChildren(
          el("p", "mr-hint", `GitLab answered ${res.status}.`),
        );
        return;
      }
      mergeRequests = res.json<MergeRequest[]>();
    } catch (error) {
      if (error instanceof BaryntError && error.code === "credential_missing") {
        root.replaceChildren(
          el(
            "p",
            "mr-hint",
            "Keep your GitLab token in your personal settings → Plugins.",
          ),
        );
        return;
      }
      throw error; // Barynt shows it as the plugin's error, with “Load again”
    }

    // Barynt's issues of this project, to find the ones a merge request mentions.
    const { issues } = await this.api.issues.list({ take: 100 });
    const byRef = new Map(issues.map((issue) => [issue.ref, issue]));

    // Which merge requests were already linked in a comment — the plugin's own storage.
    const linked = (await this.api.storage.get<number[]>("linked")) ?? [];

    const list = el("ul", "mr-list");
    for (const mr of mergeRequests) {
      const refs = (mr.title.match(/[A-Z][A-Z0-9]+-\d+/g) ?? [])
        .map((ref) => byRef.get(ref))
        .filter((issue): issue is Issue => !!issue);

      const item = el("li", "mr-item");
      const link = el(
        "a",
        "mr-title",
        `!${mr.iid} ${mr.title}`,
      ) as HTMLAnchorElement;
      link.href = mr.web_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.append(
        link,
        el("span", "mr-meta", `${mr.author.name} · ${mr.source_branch}`),
      );

      for (const issue of refs) {
        const done = linked.includes(mr.iid);
        const button = el(
          "button",
          "mr-button",
          done ? `${issue.ref} ✓` : `Link in ${issue.ref}`,
        ) as HTMLButtonElement;
        button.disabled = done;
        this.registerDomEvent(button, "click", async () => {
          button.disabled = true;
          // Written in the person's name; the audit log names the plugin.
          await this.api.comments.create(
            issue.id,
            `Merge request: [!${mr.iid} ${mr.title}](${mr.web_url})`,
          );
          linked.push(mr.iid);
          await this.api.storage.set("linked", linked);
          button.textContent = `${issue.ref} ✓`;
        });
        item.append(button);
      }
      list.append(item);
    }

    root.replaceChildren(
      el("h2", "mr-head", `${mergeRequests.length} open merge requests`),
      mergeRequests.length ? list : el("p", "mr-hint", "Nothing open."),
    );
  }
}
