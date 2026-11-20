import { listedLogo } from "@/features/plugins/directory";
import { db } from "@/lib/db";
import { hasPermission, PLATFORM } from "@/lib/permissions";
import { LOGO_FILE_RE } from "@/lib/plugins/manifest";
import { getSession } from "@/lib/session";

/**
 * A plugin's logo (BARY-235), from its active version: it came with the
 * release, checked against the directory's hash and its file signature,
 * and is stored with the version — the browser never loads it from the
 * plugin's Git host. Signed-in people only. By the plugin's id, so a tile
 * needs nothing but that; without a logo it's a 404 the tile falls back on.
 *
 * A plugin that isn't installed shows the logo of the newest release the
 * store lists (BARY-236) — to whoever may install it, since that loads
 * the release from its host.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pluginId: string }> },
) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { pluginId } = await params;
  // Briefly cached either way: an update may bring or change a logo.
  const cache = "private, max-age=300";
  const none = () =>
    new Response(null, { status: 404, headers: { "Cache-Control": cache } });
  if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(pluginId)) return none();
  const row = await db.plugin.findFirst({
    where: { pluginId, status: "active" },
    select: { id: true, manifest: true },
  });
  let logo: { file: string; content: Uint8Array } | null = null;
  if (row) {
    const file = (row.manifest as { logo?: unknown }).logo;
    const stored =
      typeof file === "string" && LOGO_FILE_RE.test(file)
        ? await db.pluginFile.findUnique({
            where: { pluginRowId_name: { pluginRowId: row.id, name: file } },
            select: { content: true },
          })
        : null;
    if (stored) logo = { file: String(file), content: stored.content };
  } else if (await hasPermission("plugin.manage", PLATFORM)) {
    logo = await listedLogo(pluginId);
  }
  if (!logo) return none();
  return new Response(new Uint8Array(logo.content), {
    headers: {
      "Content-Type": logo.file.endsWith(".png") ? "image/png" : "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": cache,
    },
  });
}
