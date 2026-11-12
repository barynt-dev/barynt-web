import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// The workspace's plugin store (BARY-201), rendered to markup: which
// plugins are released here, and the one switch its managers get.

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));
mock.module("next-intl", () => {
  const t = Object.assign((key: string) => key, { has: () => false });
  return {
    useTranslations: () => t,
    useFormatter: () => ({ dateTime: () => "date" }),
  };
});
mock.module("next/navigation", () => ({ useRouter: () => ({}) }));
mock.module("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
mock.module("@/lib/context", () => ({
  useModal: () => ({ openModal: () => "" }),
}));
mock.module("@/components/ui/layout/ConfirmDialog/ConfirmDialog", () => ({
  useConfirm: () => async () => false,
}));
mock.module("@/features/plugins/actions", () => pluginActionsMock());

import { ScopeStore } from "@/features/plugins/components/ScopeStore/ScopeStore";
import type {
  ScopeStorePlugin,
  ScopeStoreView,
} from "@/features/plugins/queries";
import { pluginActionsMock } from "./pluginActionsMock";

const base: ScopeStorePlugin = {
  pluginId: "timeline",
  name: "Timeline",
  author: "Acme",
  authorUrl: null,
  description: "Issues on a time line.",
  kind: "sandbox",
  levels: ["workspace", "project"],
  capabilities: ["issues:read"],
  network: [],
  previews: [],
  version: "1.0.0",
  blocked: false,
  categories: ["planning"],
  granted: true,
  workspace: { state: "active", pending: [], hasSettings: true },
  projects: {
    p1: {
      state: "needsConfirmation",
      pending: ["issues:write"],
      hasSettings: false,
    },
  },
};
const notify: ScopeStorePlugin = {
  ...base,
  pluginId: "notify",
  name: "Notify",
  levels: ["workspace"],
  categories: [],
  granted: false,
  workspace: null,
  projects: {},
};

const view = (over: Partial<ScopeStoreView> = {}): ScopeStoreView => ({
  workspaceId: "ws-1",
  projects: [
    { id: "p1", name: "Web App", slug: "web-app", color: "#7c86ff" },
    { id: "p2", name: "Mobile", slug: "mobile", color: "#5ab98a" },
  ],
  plugins: [notify, base],
  ...over,
});

const render = (v: ScopeStoreView, selected: ScopeStorePlugin | null) =>
  renderToStaticMarkup(
    <ScopeStore
      view={v}
      workspace={{
        name: "Nimbus",
        color: "#a274d9",
        siblings: [],
        label: "Workspace",
      }}
      selected={selected}
      tab="overview"
      category={null}
    />,
  );

describe("ScopeStore", () => {
  it("lists what's released here apart from what's available", () => {
    const html = render(view(), null);
    const on = html.indexOf("groupOnHere");
    const available = html.indexOf("groupAvailable");
    expect(html.indexOf("Timeline", on)).toBeLessThan(available);
    expect(html.indexOf("Notify", available)).toBeGreaterThan(available);
    // A project waits for a confirmation.
    expect(html).toContain("stateConfirm");
  });

  it("offers to take the release back once released, and says where it's on", () => {
    const html = render(view(), base);
    expect(html).toContain("unrelease");
    expect(html).toContain("releasedIn");
    // Its workspace settings, and the project it's on in.
    expect(html).toContain('href="/ws-1/settings/plugins/timeline"');
    expect(html).toContain(
      'href="/ws-1/project/web-app/settings/plugins/timeline"',
    );
  });

  it("only offers to release it while it isn't", () => {
    const html = render(view(), notify);
    expect(html).toContain("notReleasedIn");
    expect(html).not.toContain("unrelease");
    expect(html).toMatch(/>release</);
  });

  it("offers nothing for a blocked plugin", () => {
    const html = render(view(), { ...base, blocked: true });
    expect(html).not.toContain("unrelease");
    expect(html).not.toMatch(/>release</);
    expect(html).toContain("blockedByAdmin");
  });

  it("explains how plugins come in while nothing is installed", () => {
    const html = render(view({ plugins: [] }), null);
    expect(html).toContain("scopeWelcomeTitle");
    expect(html).toContain('href="/admin/plugins"');
    expect(html).not.toContain("groupAvailable");
  });
});
