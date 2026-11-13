import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// A plugin's page in a project (BARY-201), rendered to markup: a released
// plugin gets switched on here, a running one shows its settings and what
// switches it off.

mock.module("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <i data-icon={icon} />,
}));
mock.module("next-intl", () => {
  const t = Object.assign((key: string) => key, { has: () => false });
  return {
    useTranslations: () => t,
    useLocale: () => "en",
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
mock.module("@/components/ui/layout/ConfirmDialog/ConfirmDialog", () => ({
  useConfirm: () => async () => false,
}));
mock.module("@/features/plugins/actions", () => pluginActionsMock());

import { PluginSettings } from "@/features/plugins/components/PluginSettings/PluginSettings";
import type { PluginSettingsView } from "@/features/plugins/queries";
import { pluginActionsMock } from "./pluginActionsMock";

const view = (over: Partial<PluginSettingsView> = {}): PluginSettingsView => ({
  plugin: {
    pluginId: "notify",
    name: "Notify",
    author: "Acme",
    authorUrl: null,
    description: "Posts to a channel.",
    kind: "service",
    levels: ["project"],
    capabilities: ["issues:read"],
    network: [],
    previews: [],
    version: "1.0.0",
  },
  fields: [
    {
      key: "channel",
      type: "text",
      label: "Channel",
      description: null,
      default: null,
      options: [],
    },
  ],
  values: {},
  state: "active",
  views: [],
  credentials: [],
  settingsPage: false,
  ...over,
});

const inProject = { workspaceId: "ws-1", projectId: "p1" };
const render = (
  v: PluginSettingsView,
  scope: { workspaceId: string; projectId: string | null } = inProject,
) => renderToStaticMarkup(<PluginSettings view={v} scope={scope} />);

describe("PluginSettings", () => {
  it("switches a released plugin on in the project, after a confirmation", () => {
    const html = render(view({ state: "off" }));
    expect(html).toContain("switchOnInProject");
    expect(html).toContain("switchOnConfirm");
    // No settings and no way off before it runs.
    expect(html).not.toContain("Channel");
    expect(html).not.toContain("offInProject");
    // A project admin has no store to go to.
    expect(html).not.toContain("openInStore");
  });

  it("shows a running plugin's settings and what switches it off", () => {
    const html = render(view());
    expect(html).toContain("Channel");
    expect(html).toContain("offInProject");
    expect(html).not.toContain("switchOnInProject");
  });

  it("says so when a running plugin has nothing to set", () => {
    const html = render(view({ fields: [] }));
    expect(html).toContain("noSettings");
  });

  it("asks again after an update wants more", () => {
    const html = render(view({ state: "needsConfirmation" }));
    expect(html).toContain("confirmAgainTitle");
    expect(html).toContain("Channel");
  });

  it("leaves switching off in the workspace to the store", () => {
    const html = render(view(), { workspaceId: "ws-1", projectId: null });
    expect(html).toContain("openInStore");
    expect(html).not.toContain("offInProject");
  });
});
