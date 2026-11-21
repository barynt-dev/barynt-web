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
import { ShareDialog } from "@/features/plugins/components/PluginStore/ShareDialog";
import { featurePreviewUrl } from "@/features/plugins/components/PluginStore/StoreHome";
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
  about: null,
  links: [],
  version: "1.0.0",
  blocked: false,
  serviceAddress: null,
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
  notes: {
    "1.1.0":
      "Moves issues on drag.\n- Drag a bar to reschedule\n- <b>not html</b>",
  },
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
  dev: null,
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

  it("has a share button, as an icon, for an installed and a listed plugin (BARY-237)", () => {
    for (const selected of [timeline, notify]) {
      const html = render({ selected });
      expect(html).toContain('aria-label="share"');
      expect(html).toContain('data-icon="lucide:share-2"');
    }
  });

  it("starts a plugin that isn't installed on its newest release, not on a newer beta (BARY-237)", () => {
    const html = render({
      selected: {
        ...notify,
        listing: listing(["2.1.0-beta.1", "2.0.0", "1.9.0"]),
      },
    });
    // The picker's button shows what the install button installs.
    expect(html).toContain("v2.0.0");
    expect(html).not.toContain("v2.1.0-beta.1");
  });

  it("starts on the newest beta when there is no release", () => {
    const html = render({
      selected: {
        ...notify,
        listing: listing(["0.1.0-beta.3", "0.1.0-beta.2"]),
      },
    });
    expect(html).toContain("v0.1.0-beta.3");
  });

  it("has no picker for a plugin with one version", () => {
    expect(render({ selected: notify })).not.toContain('title="version"');
  });

  it("lays out the versions: available, active, the one to go back to, older ones", () => {
    const html = render({ selected: timeline, tab: "versions" });
    for (const kind of ["available", "active", "superseded", "listed"])
      expect(html).toContain(`data-kind="${kind}"`);
    expect(html).toContain("rollbackTo");
    expect(html).toContain("installOlder");
  });

  it("heads the capabilities with what the plugin may do, not its version, and a note (BARY-237)", () => {
    for (const tab of ["capabilities"] as const)
      for (const selected of [timeline, notify]) {
        const html = render({ selected, tab });
        expect(html).toContain("capsMay");
        expect(html).not.toContain("capsOfVersion");
        expect(html).not.toContain("capsOfInstalled");
        // The one sentence, as a note with its icon.
        expect(html).toMatch(/<p[^>]*role="note"[^>]*>.*capabilitiesIntro/);
        expect(html).toContain('data-icon="lucide:info"');
      }
  });

  it("puts what the update changes above what the installed version may do", () => {
    const html = render({ selected: timeline, tab: "capabilities" });
    expect(html).toContain("updateChangesTitle");
    expect(html).toContain("capsMay");
    expect(html.indexOf("updateChangesTitle")).toBeLessThan(
      html.indexOf("capsMay"),
    );
    // And no update card without an update.
    const current = { ...timeline, update: null };
    expect(render({ selected: current, tab: "capabilities" })).not.toContain(
      "updateChangesTitle",
    );
  });

  it("shows a version's release notes as text, bullets as a list", () => {
    const html = render({ selected: timeline, tab: "versions" });
    expect(html).toContain("Moves issues on drag.");
    expect(html).toContain("<li>Drag a bar to reschedule</li>");
    // Text, never markup.
    expect(html).toContain("&lt;b&gt;not html&lt;/b&gt;");
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

  it("lists local plugins below the sources, with what's wrong (BARY-221)", () => {
    const html = render({
      sourcesOpen: true,
      view: {
        ...view,
        dev: [
          {
            source: "/work/open-issues/dist",
            installed: false,
            ok: true,
            id: "open-issues",
            name: "Open Issues",
            version: "0.1.0",
            kind: "sandbox",
            capabilities: ["issues:read"],
          },
          {
            source: "/work/broken/dist",
            installed: false,
            ok: false,
            errors: ["version: expected MAJOR.MINOR.PATCH"],
          },
        ],
      },
    });
    expect(html).toContain("dev.title");
    expect(html).toContain("Open Issues");
    expect(html).toContain("dev.install");
    expect(html).toContain("/work/broken/dist");
    expect(html).toContain("version: expected MAJOR.MINOR.PATCH");
    expect(render({ sourcesOpen: true })).not.toContain("dev.title");
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

  it("shows a featured plugin on a card with a large logo, its version and a way in (BARY-237)", () => {
    const featured = (id: string, versions: string[]) => ({
      ...notify,
      id,
      name: id,
      listing: { ...listing(versions), featured: true, added: "2026-11-01" },
    });
    const html = render({
      view: {
        ...view,
        entries: [featured("alpha", ["2.1.0-beta.1", "2.0.0"]), timeline],
      },
    });
    const section = html.slice(html.indexOf("featuredTitle"));
    expect(section).toContain('data-size="hero"');
    // The newest real release, not the newer beta.
    expect(section).toContain("Acme · v2.0.0");
    expect(section).not.toContain("v2.1.0-beta.1");
    expect(section).not.toContain("arrow-up-right");
  });

  it("takes a featured card's screenshot from the installed version, else from the store's release", () => {
    expect(featurePreviewUrl(timeline)).toBe(
      "/api/plugin-previews/r1/preview-1.png",
    );
    expect(featurePreviewUrl(notify)).toBe(
      "/api/plugin-listed-previews/notify",
    );
    // Installed, but without a screenshot of its own.
    expect(
      featurePreviewUrl({
        ...timeline,
        installed: { ...installed, previews: [] },
      }),
    ).toBe("/api/plugin-listed-previews/timeline");
  });

  it("shows an installed featured plugin with the version it runs", () => {
    const html = render({
      view: {
        ...view,
        entries: [
          {
            ...timeline,
            listing: { ...listing(["1.1.0", "1.0.0"]), featured: true },
          },
        ],
      },
    });
    expect(html.slice(html.indexOf("featuredTitle"))).toContain(
      `Acme · v${installed.version}`,
    );
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
    const html = render({
      view: { sources: [], entries: [], unreadable: [], dev: null },
    });
    expect(html).toContain("welcomeTitle");
    expect(html).toContain("stepSourceTitle");
  });
});

describe("ShareDialog (BARY-237)", () => {
  const render = (over: Partial<Parameters<typeof ShareDialog>[0]> = {}) =>
    renderToStaticMarkup(
      <ShareDialog
        name="GitHub"
        description="Pull requests & checks."
        url="https://github.com/acme/gantt"
        isPublic
        sheet={false}
        close={() => {}}
        {...over}
      />,
    );

  it("offers the address, HTML for a website and eight networks as icon buttons", () => {
    const html = render();
    expect(html).toContain("https://github.com/acme/gantt");
    expect(html).toContain("shareEmbed");
    // The plain link, shown as text.
    expect(html).toContain(
      "&lt;a href=&quot;https://github.com/acme/gantt&quot; target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;&gt;GitHub&lt;/a&gt;",
    );
    expect(html.match(/target="_blank"/g)).toHaveLength(8);
    for (const part of [
      "linkedin.com/sharing",
      "x.com/intent",
      "facebook.com/sharer",
      "wa.me/",
      "t.me/share",
      "reddit.com/submit",
      "xing.com/spi",
      "bsky.app/intent",
    ])
      expect(html).toContain(part);
    // Their logos in colour, and no words next to them.
    expect(html).toContain('data-icon="logos:linkedin-icon"');
    expect(html).toContain('data-icon="logos:whatsapp-icon"');
    expect(html).not.toContain("<span>LinkedIn</span>");
  });

  it("escapes the name in the HTML it offers", () => {
    const html = render({ name: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&amp;lt;img src=x");
  });

  it("says when the address only opens signed in", () => {
    expect(render()).toContain("shareLinkPublic");
    const page = render({ isPublic: false });
    expect(page).toContain("shareLinkPage");
    expect(page).toContain("data-warn");
  });
});
