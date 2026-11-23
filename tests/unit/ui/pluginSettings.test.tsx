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
mock.module("next/navigation", () => ({
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));
mock.module("@/features/github/actions", () => ({
  connectGitHubInstallation: async () => ({ ok: true }),
  dismissGitHubChoice: async () => ({ ok: true }),
  refreshGitHubConnections: async () => ({ ok: true }),
  removePluginConnection: async () => ({ ok: true }),
}));
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
    about: null,
    links: [],
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
  connection: null,
  ...over,
});

const inProject = { workspaceId: "ws-1", projectId: "p1" };
const render = (
  v: PluginSettingsView,
  scope: { workspaceId: string; projectId: string | null } = inProject,
) => renderToStaticMarkup(<PluginSettings view={v} scope={scope} />);

const connection = {
  title: "GitHub",
  appReady: true,
  connections: [],
  choice: null,
  repositories: null,
  connectHref: "/api/github/connect?plugin=notify&workspace=ws-1",
  installHref: "/api/github/connect?plugin=notify&workspace=ws-1&mode=install",
};
const repos = {
  key: "repositories",
  type: "repositories" as const,
  label: "Repositories",
  description: null,
  default: null,
  options: [
    {
      id: "acme/api",
      label: "acme/api",
      private: true,
      url: "https://github.com/acme/api",
    },
    { id: "acme/web", label: "acme/web", url: "https://github.com/acme/web" },
  ],
  connected: true,
  failed: [],
};

describe("PluginSettings, connected to GitHub (BARY-238)", () => {
  it("lets a workspace connect for its projects, with nothing to switch on", () => {
    const html = render(view({ state: "off", fields: [], connection }), {
      workspaceId: "ws-1",
      projectId: null,
    });
    expect(html).toContain("github.hintWorkspace");
    expect(html).toContain(
      'href="/api/github/connect?plugin=notify&amp;workspace=ws-1"',
    );
    expect(html).not.toContain("switchOnInProject");
    expect(html).not.toContain("noSettings");
  });

  it("shows the workspace's account in a project, without taking it off there", () => {
    const html = render(
      view({
        fields: [],
        connection: {
          ...connection,
          connections: [
            {
              rowId: "c1",
              account: "acme",
              accountType: "Organization",
              avatar: null,
              inherited: true,
              broken: false,
              manageUrl:
                "https://github.com/organizations/acme/settings/installations/7",
            },
          ],
        },
      }),
    );
    expect(html).toContain("acme");
    expect(html).toContain("github.fromWorkspace");
    expect(html).not.toContain("github.disconnect");
    expect(html).toContain("github.connect");
  });

  it("offers the installations to pick after signing in at GitHub", () => {
    const html = render(
      view({
        fields: [],
        connection: {
          ...connection,
          choice: [
            {
              id: "7",
              account: "acme",
              accountType: "Organization",
              avatar: null,
            },
          ],
        },
      }),
    );
    expect(html).toContain("github.choose");
    expect(html).toContain("github.connectThis");
    expect(html).toContain("mode=install");
  });

  it("shows in the workspace which project works with which repository", () => {
    const html = render(
      view({
        state: "off",
        fields: [],
        connection: {
          ...connection,
          connections: [
            {
              rowId: "c1",
              account: "acme",
              accountType: "Organization",
              avatar: null,
              inherited: false,
              broken: false,
              manageUrl:
                "https://github.com/organizations/acme/settings/installations/7",
            },
          ],
          repositories: [
            {
              fullName: "acme/web",
              visibility: "private",
              archived: false,
              fork: false,
              description: "The web app",
              url: "https://github.com/acme/web",
              unreachable: false,
              projects: [
                {
                  name: "Web App",
                  color: "#7c86ff",
                  href: "/ws-1/project/web-app/settings/plugins/notify",
                },
              ],
            },
            {
              fullName: "acme/docs",
              visibility: "public",
              archived: true,
              fork: true,
              description: null,
              url: "https://github.com/acme/docs",
              unreachable: false,
              projects: [],
            },
          ],
        },
      }),
      { workspaceId: "ws-1", projectId: null },
    );
    expect(html).toContain("github.reposTitle");
    expect(html).toContain("acme/web");
    expect(html).toContain(
      'href="/ws-1/project/web-app/settings/plugins/notify"',
    );
    expect(html).toContain("Web App");
    expect(html).toContain("github.unlinked");
    // Links to GitHub, and what each repository is.
    expect(html).toContain('href="https://github.com/acme/web"');
    expect(html).toContain("The web app");
    expect(html).toContain("github.archived");
    expect(html).toContain("github.fork");
    expect(html).toContain("github.public");
  });

  it("marks a connection GitHub no longer answers for, without a repository list", () => {
    const html = render(
      view({
        state: "off",
        fields: [],
        connection: {
          ...connection,
          connections: [
            {
              rowId: "c1",
              account: "acme",
              accountType: "Organization",
              avatar: null,
              inherited: false,
              broken: true,
              manageUrl:
                "https://github.com/organizations/acme/settings/installations/7",
            },
          ],
          repositories: [],
        },
      }),
      { workspaceId: "ws-1", projectId: null },
    );
    expect(html).toContain("github.broken");
    expect(html).toContain("github.refresh");
    expect(html).not.toContain("github.reposTitle");
  });

  it("says when the instance has no GitHub App", () => {
    const html = render(
      view({ fields: [], connection: { ...connection, appReady: false } }),
    );
    expect(html).toContain("github.noApp");
    expect(html).not.toContain("/api/github/connect");
  });

  it("lists the repositories to tick, the chosen ones ticked", () => {
    const html = render(
      view({
        fields: [repos],
        values: { repositories: ["acme/web", "gone/repo"] },
        connection,
      }),
    );
    // Chosen but out of reach: still there, ticked, to untick.
    const gone = html.slice(html.indexOf("gone/"));
    expect(
      html.lastIndexOf('checked=""', html.indexOf("gone/")),
    ).toBeGreaterThan(-1);
    expect(gone).toContain("github.unreachable");
    expect(html).toContain("github.private");
    expect(html).toContain(">api<");
    // Each reachable one opens on GitHub, beside its row.
    expect(html).toContain('href="https://github.com/acme/web"');
  });

  it("falls back to typing them without a connection", () => {
    const html = render(
      view({
        fields: [{ ...repos, options: [], connected: false }],
        values: { repositories: "acme/web" },
      }),
    );
    expect(html).toContain("<textarea");
    expect(html).toContain("acme/web");
    expect(html).toContain("github.typeRepos");
  });
});

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

  it("offers a link hook's rules, each with the status it sets (BARY-227)", () => {
    const html = render(
      view({
        fields: [],
        inbound: [
          {
            id: "row-1",
            hookId: "github",
            title: "GitHub repository",
            provider: "github",
            handle: "link",
            url: "https://barynt.test/api/plugins/hooks/tok",
            secret: "s",
            last: null,
            rules: [
              {
                id: "opened",
                title: "When a pull request is opened",
                on: "pull_request.opened",
                status: null,
              },
              {
                id: "merged",
                title: "When a pull request is merged",
                on: "pull_request.merged",
                status: "done",
              },
            ],
            statuses: [
              { id: "in_review", label: "In Review" },
              { id: "done", label: "Done" },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("inbound.howtoGithubLink");
    expect(html).toContain("inbound.rulesTitle");
    expect(html).toContain("When a pull request is merged");
    expect(html).toMatch(/<option value="done" selected="">/);
    expect(html).toContain('data-on="false"');
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
          field("merged", "status", [{ id: "done", label: "Done" }]),
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
    expect(html).toMatch(/<option value="done">Done<\/option>/);
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
