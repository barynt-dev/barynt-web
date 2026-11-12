import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// The workspace's plugin store (BARY-201), rendered to markup: which
// plugins are on here, and the switches a workspace or project admin gets.

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
  canWorkspace: true,
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
      workspaceName="Nimbus"
      selected={selected}
      tab="overview"
      category={null}
    />,
  );

describe("ScopeStore", () => {
  it("lists what's on here apart from what's available", () => {
    const html = render(view(), null);
    const on = html.indexOf("groupOnHere");
    const available = html.indexOf("groupAvailable");
    expect(html.indexOf("Timeline", on)).toBeLessThan(available);
    expect(html.indexOf("Notify", available)).toBeGreaterThan(available);
    // A project waits for a confirmation.
    expect(html).toContain("stateConfirm");
  });

  it("offers Edit once it runs somewhere, and says where", () => {
    const html = render(view(), base);
    expect(html).not.toContain("placesAdd");
    expect(html).toContain("placesEdit");
    expect(html).toContain("onIn");
    // A project waits for a confirmation; a way to confirm is right there.
    expect(html).toContain("placesWaiting");
    // On with a settings form: its place leads to the settings.
    expect(html).toContain('href="/ws-1/settings/plugins/timeline"');
  });

  it("only offers Add while it runs nowhere", () => {
    const html = render(view(), notify);
    expect(html).toContain("placesAdd");
    expect(html).not.toContain("placesEdit");
    expect(html).toContain("onNowhere");
  });

  it("offers nothing for a blocked plugin", () => {
    const html = render(view(), { ...base, blocked: true });
    expect(html).not.toContain("placesAdd");
    expect(html).toContain("blockedByAdmin");
  });

  it("offers nothing to someone who manages no place for it", () => {
    const html = render(view({ canWorkspace: false, projects: [] }), notify);
    expect(html).not.toContain("placesAdd");
  });
});
