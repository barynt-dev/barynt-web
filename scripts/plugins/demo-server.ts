// A local plugin directory with a few demo plugins, for trying the plugin
// pages without a real directory (BARY-143). It plays a Gitea/Forgejo server
// (BARY-198) — the directory through Gitea's API, the releases at Gitea's
// download addresses — and a plain web server at the same time. The app
// reads it when `PLUGIN_DEV_BASE` points here (development only, see
// `lib/plugins/dev.ts`):
//
//   bun run plugins:demo                       # http://localhost:4555
//   PLUGIN_DEV_BASE=http://localhost:4555      # in .env, then restart the app
//   Admin → Plugins → Add source, either
//     http://localhost:4555/barynt-demo/plugins   (provider Gitea / Forgejo)
//     http://localhost:4555/plugins.json          (web server)
//
// Most plugins only exist to be installed and switched on. Demo Timeline
// runs for real (BARY-144): `demo-plugins/timeline.ts`, built with the
// plugin SDK into one `main.js` when the server starts (BARY-146).

import { readFileSync } from "node:fs";
import {
  type DirectoryEntry,
  type ReleaseFiles,
  releaseHash,
} from "../../lib/plugins/directory";
import { validateManifest } from "../../lib/plugins/manifest";
import { type DemoScreen, demoScreenshot } from "./demo-images";

const PORT = Number(process.env.PORT ?? 4555);
const ORIGIN = `http://localhost:${PORT}`;
const enc = (s: string) => new TextEncoder().encode(s);
const demoFile = (name: string) =>
  readFileSync(new URL(`./demo-plugins/${name}`, import.meta.url), "utf8");

/** A demo plugin's `main.js`: its TypeScript with the SDK bundled in, one
 *  ES module for the browser — what a plugin's release ships. */
async function bundle(name: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [
      new URL(`./demo-plugins/${name}.ts`, import.meta.url).pathname,
    ],
    format: "esm",
    target: "browser",
  });
  if (!built.success)
    throw new Error(built.logs.map((log) => log.message).join("\n"));
  return built.outputs[0].text();
}

interface Demo {
  entry: Omit<DirectoryEntry, "versions">;
  manifest: Record<string, unknown>;
  /** Per version: what changes in the manifest. */
  versions: Record<string, Record<string, unknown>>;
  /** Lists a wrong hash — the install is refused. */
  tampered?: boolean;
  /** Screenshots in the release (BARY-199). */
  previews?: { title: string; screen: DemoScreen; accent: string }[];
  /** Real code instead of the placeholder: `demo-plugins/<name>.ts`
   *  (bundled with the SDK) and `.css` (BARY-144). */
  code?: string;
}

const DEMOS: Demo[] = [
  {
    entry: {
      id: "demo-timeline",
      name: "Demo Timeline",
      author: "Barynt demo",
      description: "Issues on a time line, as a project view.",
      repo: `${ORIGIN}/barynt-demo/timeline`,
      levels: ["workspace", "project"],
      kind: "sandbox",
      categories: ["planning"],
      featured: true,
      added: "2026-09-14",
      notes: {
        "1.1.0":
          "Bars can now be dragged to reschedule an issue – that's why it asks to change issues.\n- Drag a bar to move start and due date\n- Weekends are shaded\n- Faster with many issues\n- Fixed: today's line was off by a day in some time zones",
        "1.0.0": "First release.\n- Issues on a time line, per project",
      },
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      authorUrl: "https://example.com",
      contributes: {
        projectViews: [{ id: "timeline", title: "Timeline" }],
        navItems: [{ id: "roadmap", title: "Roadmap" }],
        dashboardWidgets: [{ id: "oldest-open", title: "Oldest open issues" }],
      },
    },
    versions: {
      "1.0.0": {
        capabilities: [
          "issues:read",
          "ui:project-view",
          "ui:nav-item",
          "ui:dashboard-widget",
        ],
      },
      // The update asks for one more: workspaces have to confirm again.
      "1.1.0": {
        capabilities: [
          "issues:read",
          "issues:write",
          "ui:project-view",
          "ui:nav-item",
          "ui:dashboard-widget",
        ],
      },
    },
    code: "timeline",
    previews: [
      { title: "Timeline per project", screen: "timeline", accent: "#e8743b" },
      { title: "Drag to reschedule", screen: "board", accent: "#e8743b" },
      { title: "Settings", screen: "settings", accent: "#e8743b" },
    ],
  },
  {
    entry: {
      id: "demo-gitlab-mrs",
      name: "Demo GitLab Merge Requests",
      author: "Barynt demo",
      description:
        "Open merge requests of a GitLab project, next to the issues they mention.",
      repo: `${ORIGIN}/barynt-demo/gitlab-mrs`,
      levels: ["project"],
      kind: "sandbox",
      categories: ["development"],
      added: "2026-11-13",
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      network: ["gitlab.com"],
      contributes: {
        projectViews: [
          {
            id: "merge-requests",
            title: "Merge Requests",
            icon: "lucide:git-pull-request",
          },
        ],
        settings: [
          {
            key: "gitlabProject",
            type: "text",
            label: "GitLab project",
            description: "Path of the project, e.g. acme/web.",
          },
        ],
        credentials: [
          {
            key: "token",
            label: "GitLab access token",
            description: "A personal token with read_api.",
            level: "user",
            host: "gitlab.com",
            header: "PRIVATE-TOKEN",
            format: "{value}",
          },
        ],
        settingsPage: true,
      },
    },
    versions: {
      "0.1.0": {
        capabilities: [
          "issues:read",
          "comments:write",
          "storage:own",
          "ui:project-view",
        ],
      },
    },
    code: "gitlab-mrs",
  },
  {
    entry: {
      id: "demo-notify",
      name: "Demo Chat Notifications",
      author: "Barynt demo",
      description: "Posts new issues to a chat channel, from its own server.",
      repo: `${ORIGIN}/barynt-demo/notify`,
      levels: ["workspace"],
      kind: "service",
      categories: ["communication"],
      featured: true,
      added: "2026-10-28",
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "Apache-2.0",
      network: ["hooks.example.com"],
      contributes: {
        settings: [
          {
            key: "channel",
            type: "text",
            label: "Channel",
            description: "Where new issues are posted, e.g. #dev.",
          },
          {
            key: "events",
            type: "select",
            label: "What to post",
            default: "new",
            options: [
              { id: "new", label: "New issues" },
              { id: "done", label: "New and done issues" },
              { id: "all", label: "Every change" },
            ],
          },
          {
            key: "mentionAssignee",
            type: "boolean",
            label: "Mention the assignee",
            default: true,
          },
          {
            key: "quietHours",
            type: "number",
            label: "Quiet after (hour, 0–23)",
            description: "No posts after this hour until 8 am.",
          },
        ],
      },
    },
    versions: { "1.0.0": { capabilities: ["events:issue", "notify:send"] } },
    previews: [
      { title: "A message in the channel", screen: "chat", accent: "#3b7bd5" },
      { title: "Channel per workspace", screen: "settings", accent: "#3b7bd5" },
      { title: "What gets posted", screen: "list", accent: "#3b7bd5" },
    ],
  },
  {
    entry: {
      id: "demo-tampered",
      name: "Demo Tampered",
      author: "Barynt demo",
      description: "Its files don't match the directory — installing it fails.",
      repo: `${ORIGIN}/barynt-demo/tampered`,
      levels: ["project"],
      kind: "sandbox",
      categories: ["development"],
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      contributes: { issueBadges: [{ id: "badge", title: "Badge" }] },
    },
    versions: { "1.0.0": { capabilities: ["ui:issue-badge"] } },
    tampered: true,
  },
  {
    entry: {
      id: "demo-time-tracking",
      name: "Demo Time Tracking",
      author: "Tempo Labs",
      description: "Book time on an issue, see it per project.",
      repo: `${ORIGIN}/barynt-demo/time-tracking`,
      levels: ["project"],
      kind: "declarative",
      categories: ["time", "reports"],
      featured: true,
      added: "2026-11-02",
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      contributes: {
        fields: [{ key: "spent", name: "Time spent", type: "NUMBER" }],
        issueBadges: [{ id: "spent", title: "Time spent" }],
      },
    },
    versions: {
      "1.2.0": { capabilities: ["fields:write", "ui:issue-badge"] },
    },
    previews: [
      { title: "Time on the issue", screen: "list", accent: "#2fb3a0" },
      { title: "Per project", screen: "board", accent: "#2fb3a0" },
    ],
  },
  {
    entry: {
      id: "demo-recurring",
      name: "Demo Recurring Issues",
      author: "Barynt demo",
      description:
        "Creates issues on a schedule – weekly reviews, monthly reports.",
      repo: `${ORIGIN}/barynt-demo/recurring`,
      levels: ["project"],
      kind: "declarative",
      categories: ["automation"],
      added: "2026-11-07",
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      contributes: {
        settings: [{ key: "cron", type: "text", label: "Schedule" }],
      },
    },
    versions: { "0.3.0": { capabilities: [] } },
  },
  {
    entry: {
      id: "demo-error-inbox",
      name: "Demo Error Inbox",
      author: "Barynt demo",
      description:
        "New errors from your error tracker become issues, with the stack trace.",
      repo: `${ORIGIN}/barynt-demo/error-inbox`,
      levels: ["project"],
      kind: "service",
      categories: ["development", "support"],
      added: "2026-10-03",
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "Apache-2.0",
      network: ["errors.example.com"],
    },
    versions: {
      "2.0.1": { capabilities: ["issues:write", "events:issue"] },
    },
  },
];

/** Every release's files, by `<repo>/<version>`. */
const releases = new Map<string, ReleaseFiles>();
const bundled = new Map<string, string>();
for (const demo of DEMOS)
  if (demo.code) bundled.set(demo.code, await bundle(demo.code));

const directory = DEMOS.map((demo) => {
  const versions: Record<string, string> = {};
  for (const [version, extra] of Object.entries(demo.versions)) {
    const manifest = {
      id: demo.entry.id,
      name: demo.entry.name,
      version,
      author: demo.entry.author,
      description: demo.entry.description,
      kind: demo.entry.kind,
      levels: demo.entry.levels,
      network: [],
      ...demo.manifest,
      ...extra,
      ...(demo.previews && {
        previews: demo.previews.map((p, i) => ({
          file: `preview-${i + 1}.png`,
          title: p.title,
        })),
      }),
    };
    const checked = validateManifest(manifest);
    if (!checked.ok)
      throw new Error(
        `${demo.entry.id}@${version}: ${JSON.stringify(checked.errors)}`,
      );
    const files: ReleaseFiles = {
      "manifest.json": enc(JSON.stringify(manifest, null, 2)),
      ...(demo.entry.kind === "sandbox" &&
        (demo.code
          ? {
              "main.js": enc(bundled.get(demo.code) ?? ""),
              "styles.css": enc(demoFile(`${demo.code}.css`)),
            }
          : {
              "main.js": enc(
                `// ${demo.entry.name} ${version} — a demo, it runs nothing.\nexport default class {}\n`,
              ),
              "styles.css": enc(".demo { color: inherit; }\n"),
            })),
      ...Object.fromEntries(
        (demo.previews ?? []).map((p, i) => [
          `preview-${i + 1}.png`,
          demoScreenshot(p.screen, p.accent),
        ]),
      ),
    };
    releases.set(
      `${new URL(demo.entry.repo).pathname.slice(1)}/${version}`,
      files,
    );
    versions[version] = demo.tampered ? "0".repeat(64) : releaseHash(files);
  }
  return { ...demo.entry, versions };
});

/** Gitea's download address, `/<owner>/<repo>/releases/download/<tag>/<file>`,
 *  and a web server's, `/<owner>/<repo>/<version>/<file>`. */
const RELEASE = /^\/([^/]+\/[^/]+)\/(?:releases\/download\/)?([^/]+)\/([^/]+)$/;
const GITEA_DIRECTORY = "/api/v1/repos/barynt-demo/plugins/raw/plugins.json";

Bun.serve({
  port: PORT,
  fetch(req) {
    const { pathname } = new URL(req.url);
    console.log(`${req.method} ${pathname}`);
    if (pathname === "/plugins.json" || pathname === GITEA_DIRECTORY)
      return Response.json(directory);
    const m = pathname.match(RELEASE);
    const file =
      m &&
      releases.get(`${m[1]}/${decodeURIComponent(m[2])}`)?.[
        m[3] as keyof ReleaseFiles
      ];
    return file
      ? new Response(file as Uint8Array<ArrayBuffer>, {
          headers: { "content-type": "application/octet-stream" },
        })
      : new Response("not found", { status: 404 });
  },
});

console.log(`Demo plugin directory, as Gitea: ${ORIGIN}/barynt-demo/plugins`);
console.log(`Demo plugin directory, as a web server: ${ORIGIN}/plugins.json`);
console.log(`Set PLUGIN_DEV_BASE=http://localhost:${PORT} for the app.`);
