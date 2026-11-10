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
// The plugins only exist to be installed and switched on — they run nothing.

import {
  type DirectoryEntry,
  type ReleaseFiles,
  releaseHash,
} from "../../lib/plugins/directory";
import { validateManifest } from "../../lib/plugins/manifest";

const PORT = Number(process.env.PORT ?? 4555);
const ORIGIN = `http://localhost:${PORT}`;
const enc = (s: string) => new TextEncoder().encode(s);

interface Demo {
  entry: Omit<DirectoryEntry, "versions">;
  manifest: Record<string, unknown>;
  /** Per version: what changes in the manifest. */
  versions: Record<string, Record<string, unknown>>;
  /** Lists a wrong hash — the install is refused. */
  tampered?: boolean;
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
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      authorUrl: "https://example.com",
      contributes: { projectViews: [{ id: "timeline", title: "Timeline" }] },
    },
    versions: {
      "1.0.0": { capabilities: ["issues:read", "ui:project-view"] },
      // The update asks for one more: workspaces have to confirm again.
      "1.1.0": {
        capabilities: ["issues:read", "issues:write", "ui:project-view"],
      },
    },
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
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "Apache-2.0",
      network: ["hooks.example.com"],
      contributes: {
        settings: [{ key: "channel", type: "text", label: "Channel" }],
      },
    },
    versions: { "1.0.0": { capabilities: ["events:issue", "notify:send"] } },
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
    },
    manifest: {
      minBaryntVersion: "0.9.0",
      license: "MIT",
      contributes: { issueBadges: [{ id: "badge", title: "Badge" }] },
    },
    versions: { "1.0.0": { capabilities: ["ui:issue-badge"] } },
    tampered: true,
  },
];

/** Every release's files, by `<repo>/<version>`. */
const releases = new Map<string, ReleaseFiles>();
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
    };
    const checked = validateManifest(manifest);
    if (!checked.ok)
      throw new Error(
        `${demo.entry.id}@${version}: ${JSON.stringify(checked.errors)}`,
      );
    const files: ReleaseFiles = {
      "manifest.json": enc(JSON.stringify(manifest, null, 2)),
      ...(demo.entry.kind === "sandbox" && {
        "main.js": enc(
          `// ${demo.entry.name} ${version} — a demo, it runs nothing.\nexport default class {}\n`,
        ),
        "styles.css": enc(".demo { color: inherit; }\n"),
      }),
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
