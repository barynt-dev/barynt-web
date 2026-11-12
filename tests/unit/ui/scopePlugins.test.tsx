import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// The plugin page of a workspace and a project (BARY-143), rendered to
// markup: which switches and states it shows for which plugin.

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));
mock.module("next-intl", () => {
  const t = Object.assign((key: string) => key, { has: () => false });
  return { useTranslations: () => t, useFormatter: () => ({}) };
});
mock.module("next/navigation", () => ({ useRouter: () => ({}) }));
mock.module("@/lib/context", () => ({
  useModal: () => ({ openModal: () => "" }),
}));
mock.module("@/components/ui/layout/ConfirmDialog/ConfirmDialog", () => ({
  useConfirm: () => async () => false,
}));
// Every export the plugin pages use — `pluginStore.test.tsx` runs in the
// same process and replaces this module too.
mock.module("@/features/plugins/actions", () => pluginActionsMock());

import { ScopePlugins } from "@/features/plugins/components/ScopePlugins/ScopePlugins";
import type { ScopePlugin } from "@/features/plugins/queries";
import { pluginActionsMock } from "./pluginActionsMock";

const base: ScopePlugin = {
  pluginId: "gantt-timeline",
  name: "Gantt Timeline",
  author: "Acme",
  authorUrl: null,
  description: "Issues on a time line.",
  kind: "sandbox",
  levels: ["workspace", "project"],
  capabilities: ["issues:read"],
  network: [],
  previews: [],
  version: "1.1.0",
  activation: null,
  offered: true,
};

const render = (plugins: ScopePlugin[], projectId?: string) =>
  renderToStaticMarkup(
    <ScopePlugins plugins={plugins} workspaceId="ws-1" projectId={projectId} />,
  );

describe("ScopePlugins", () => {
  it("offers the release for projects in the workspace only", () => {
    const ws = render([{ ...base, granted: false, projectsOn: 0 }]);
    expect(ws).toContain('id="plugin-grant-gantt-timeline"');
    expect(ws).toContain("colProjects");
    const project = render([base], "p1");
    expect(project).not.toContain('id="plugin-grant-gantt-timeline"');
    expect(project).not.toContain("colProjects");
  });

  it("asks to confirm again after an update asked for more", () => {
    const html = render([
      {
        ...base,
        activation: { state: "needsConfirmation", pending: ["issues:write"] },
      },
    ]);
    expect(html).toContain("confirmAgain");
    // Still switched on meanwhile, with what was confirmed before.
    expect(html).toMatch(/id="plugin-on-gantt-timeline"[^>]*checked/);
  });

  it("shows a blocked plugin as blocked, with its data to delete", () => {
    const html = render([
      {
        ...base,
        offered: false,
        activation: { state: "blocked", pending: [] },
      },
    ]);
    expect(html).toContain("statusBlocked");
    expect(html).toContain('aria-label="deleteData"');
  });

  it("has no switch for what can't be switched on here", () => {
    const html = render([{ ...base, offered: false }], "p1");
    expect(html).not.toContain('id="plugin-on-gantt-timeline"');
  });

  it("says so when there's nothing", () => {
    expect(render([], "p1")).toContain("projectEmpty");
    expect(render([])).toContain("workspaceEmpty");
  });
});
