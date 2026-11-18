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
mock.module("@/lib/context", () => ({
  useModal: () => ({ openModal: () => "" }),
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
  service: null,
  inbound: [],
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

  it("shows its server, how it's doing, and the way back after a pause (BARY-212)", () => {
    const service = {
      activationId: "act-1",
      url: "https://ci.acme.dev/barynt",
      address: "fixed" as const,
      suggestion: "https://ci.acme.dev/barynt",
      events: ["issue.status_changed", "member.added"],
      pausedAt: null,
      failingSince: null,
      last: { at: new Date(), status: 204, error: null },
    };
    const html = render(view({ fields: [], service }));
    expect(html).toContain("service.title");
    expect(html).toContain("https://ci.acme.dev/barynt");
    expect(html).toContain("issue.status_changed");
    expect(html).toContain("HTTP 204");
    expect(html).toContain('data-state="ok"');
    expect(html).not.toContain("noSettings");
    expect(html).not.toContain("service.resume");

    const paused = render(
      view({
        fields: [],
        service: { ...service, pausedAt: new Date(), failingSince: new Date() },
      }),
    );
    expect(paused).toContain('data-state="paused"');
    expect(paused).toContain("service.pausedHint");
    expect(paused).toContain("service.resume");
  });

  it("asks for the address of a server run just here, and says when the operator's is missing (BARY-223)", () => {
    const base = {
      activationId: "act-1",
      events: ["issue.created"],
      pausedAt: null,
      failingSince: null,
      last: null,
    };
    const own = render(
      view({
        fields: [],
        service: {
          ...base,
          url: null,
          address: "activation" as const,
          suggestion: "https://ci.example.dev/hook",
        },
      }),
    );
    expect(own).toContain('name="url"');
    expect(own).toContain("service.suggested");
    expect(own).toContain('data-state="noAddress"');
    expect(own).not.toContain("service.test");

    const operator = render(
      view({
        fields: [],
        service: {
          ...base,
          url: null,
          address: "platform" as const,
          suggestion: null,
        },
      }),
    );
    expect(operator).toContain("service.platformMissing");
    expect(operator).not.toContain('name="url"');

    const running = render(
      view({
        fields: [],
        service: {
          ...base,
          url: "http://barynt-github:8080/events",
          address: "platform" as const,
          suggestion: null,
        },
      }),
    );
    expect(running).toContain("service.byOperator");
    expect(running).toContain("service.test");
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

  it("draws every kind of setting (BARY-204)", () => {
    const field = (
      key: string,
      type: PluginSettingsView["fields"][number]["type"],
      options: { id: string; label: string }[] = [],
    ) => ({ key, type, label: key, description: null, default: null, options });
    const html = render(
      view({
        fields: [
          field("body", "textarea"),
          field("link", "url"),
          field("days", "multiselect", [
            { id: "mon", label: "Mon" },
            { id: "tue", label: "Tue" },
          ]),
          field("assignee", "member", [{ id: "u1", label: "Ada Lovelace" }]),
          field("tag", "label", [{ id: "l1", label: "Bug" }]),
        ],
        values: { days: ["tue"], body: "Hello" },
      }),
    );
    expect(html).toMatch(/<textarea[^>]*>Hello<\/textarea>/);
    expect(html).toContain('type="url"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*?Mon/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?Tue/);
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Bug");
  });

  it("puts a plugin's own page instead of the form, its section below it", () => {
    const page = render(
      view({
        plugin: { ...view().plugin, kind: "sandbox" },
        settingsPage: "page",
      }),
    );
    expect(page).toContain("<iframe");
    expect(page).not.toContain("Channel");
    const section = render(
      view({
        plugin: { ...view().plugin, kind: "sandbox" },
        settingsPage: "section",
      }),
    );
    expect(section).toContain("Channel");
    expect(section).toContain('data-part="section"');
    expect(section.indexOf("Channel")).toBeLessThan(section.indexOf("<iframe"));
  });
});
