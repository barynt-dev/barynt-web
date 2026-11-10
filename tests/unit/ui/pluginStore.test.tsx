import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// The admin plugin store (BARY-200), rendered to markup: which plugins land
// in which group, what an installed plugin's tabs show, and the panes.

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

import { PluginStore } from "@/features/plugins/components/PluginStore/PluginStore";
import type { StoreTab } from "@/features/plugins/components/PluginStore/tabs";
import type {
  InstalledPlugin,
  StoreEntry,
  StoreView,
} from "@/features/plugins/queries";
import { pluginActionsMock } from "./pluginActionsMock";

const installed: InstalledPlugin = {
  pluginId: "timeline",
  name: "Timeline",
  author: "Acme",
  authorUrl: null,
  description: "Issues on a time line.",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["issues:read", "ui:project-view"],
  network: [],
  previews: [{ title: "Board", src: "/api/plugin-previews/r1/preview-1.png" }],
  version: "1.0.0",
  blocked: false,
  versions: [
    { version: "1.0.0", status: "active", installedAt: new Date(0) },
    { version: "0.9.0", status: "superseded", installedAt: new Date(0) },
  ],
  sourceId: "s1",
  rollbackTo: "0.9.0",
  activations: 2,
};

const listing = (versions: string[]) => ({
  sourceId: "s1",
  sourceName: "Acme plugins",
  versions,
  repoUrl: "https://gitlab.acme.dev/team/x",
  releaseUrls: {},
  categories: ["planning"],
  featured: false,
  added: null,
});

const timeline: StoreEntry = {
  id: "timeline",
  name: "Timeline",
  author: "Acme",
  description: "Issues on a time line.",
  kind: "sandbox",
  levels: ["project"],
  installed,
  listing: listing(["1.1.0", "1.0.0", "0.9.0", "0.8.0"]),
  update: "1.1.0",
};
const notify: StoreEntry = {
  id: "notify",
  name: "Notify",
  author: "Acme",
  description: "Posts to a channel.",
  kind: "service",
  levels: ["workspace"],
  installed: null,
  listing: listing(["2.0.0"]),
  update: null,
};

const view: StoreView = {
  sources: [
    {
      id: "s1",
      name: "Acme plugins",
      url: "https://gitlab.acme.dev/team/plugins",
      provider: "gitlab",
      ref: null,
      enabled: true,
      private: false,
      lastSyncAt: null,
      lastSyncError: null,
    },
  ],
  entries: [notify, timeline],
  unreadable: [],
};

const render = (
  over: Partial<{
    view: StoreView;
    selected: StoreEntry | null;
    tab: StoreTab;
    sourcesOpen: boolean;
    category: string | null;
  }> = {},
) =>
  renderToStaticMarkup(
    <PluginStore
      view={over.view ?? view}
      selected={over.selected ?? null}
      tab={over.tab ?? "overview"}
      sourcesOpen={over.sourcesOpen ?? false}
      places={[]}
      category={over.category ?? null}
    />,
  );

describe("PluginStore", () => {
  it("puts an update under attention and an uninstalled plugin in the directory", () => {
    const html = render();
    const attention = html.indexOf("groupAttention");
    const directory = html.indexOf("groupDirectory");
    expect(attention).toBeGreaterThan(-1);
    expect(html.indexOf("Timeline", attention)).toBeLessThan(directory);
    expect(html.indexOf("Notify", directory)).toBeGreaterThan(directory);
    expect(html).toContain('href="/admin/plugins?plugin=notify"');
    expect(html).toContain('data-open="home"');
  });

  it("offers the update and every tab for an installed plugin", () => {
    const html = render({ selected: timeline });
    expect(html).toContain("updateTo");
    expect(html).toContain(
      'href="/admin/plugins?plugin=timeline&amp;tab=versions"',
    );
    expect(html).toContain("/api/plugin-previews/r1/preview-1.png");
    // The directory's category, among the facts.
    expect(html).toContain("categoriesLabel");
    expect(html).toContain("category.planning");
    expect(html).toContain('data-open="plugin"');
  });

  it("lays out the versions: available, active, the one to go back to, older ones", () => {
    const html = render({ selected: timeline, tab: "versions" });
    for (const kind of ["available", "active", "superseded", "listed"])
      expect(html).toContain(`data-kind="${kind}"`);
    expect(html).toContain("rollbackTo");
    expect(html).toContain("installOlder");
  });

  it("has only overview and capabilities for a plugin that isn't installed", () => {
    const html = render({ selected: notify, tab: "versions" });
    expect(html).toContain("install");
    expect(html).not.toContain("tab.versions");
    expect(html).toContain('aria-current="page"');
  });

  it("shows the sources with their provider", () => {
    const html = render({ sourcesOpen: true });
    expect(html).toContain("provider.gitlab");
    expect(html).toContain("fetchNow");
    expect(html).toContain('data-open="sources"');
  });

  it("starts with the numbers, featured, newest and every plugin by category", () => {
    const featured = {
      ...notify,
      listing: {
        ...listing(["2.0.0"]),
        categories: ["communication"],
        featured: true,
        added: "2026-11-01",
      },
    };
    const html = render({ view: { ...view, entries: [featured, timeline] } });
    for (const key of [
      "homeKpi.installed",
      "homeKpi.updates",
      "featuredTitle",
      "newestTitle",
      "category.communication",
      "category.planning",
    ])
      expect(html).toContain(key);
    // Notify is in the list on the left too — the featured card comes after
    // the section's title.
    const featuredAt = html.indexOf("featuredTitle");
    expect(html.indexOf("Notify", featuredAt)).toBeGreaterThan(featuredAt);
    expect(html).toContain('id="all-plugins"');
  });

  it("leaves out featured and newest when the directory names none", () => {
    const html = render();
    expect(html).not.toContain("featuredTitle");
    expect(html).not.toContain("newestTitle");
  });

  it("links a plugin's categories to the plugins of that category", () => {
    const html = render({ selected: timeline });
    expect(html).toContain(
      'href="/admin/plugins?category=planning#all-plugins"',
    );
  });

  it("narrows the list to the category in the address", () => {
    const html = render({ category: "communication" });
    // Neither plugin is in it: the list says so, with a way back.
    expect(html).toContain("noMatches");
    expect(html).toContain("clearCategory");
    expect(render({ category: "planning" })).toContain(
      'href="/admin/plugins?plugin=timeline"',
    );
  });

  it("welcomes a first visit", () => {
    const html = render({ view: { sources: [], entries: [], unreadable: [] } });
    expect(html).toContain("welcomeTitle");
    expect(html).toContain("stepSourceTitle");
  });
});
