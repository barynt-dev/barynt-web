import { db } from "@/lib/db";
import { LOGO_FILE_RE } from "@/lib/plugins/manifest";
import { getSession } from "@/lib/session";

/**
 * A plugin's logo (BARY-235), from its active version: it came with the
 * release, checked against the directory's hash and its file signature,
 * and is stored with the version — the browser never loads it from the
 * plugin's Git host. Signed-in people only. By the plugin's id, so a tile
 * needs nothing but that; without a logo it's a 404 the tile falls back on.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pluginId: string }> },
) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { pluginId } = await params;
  // Briefly cached either way: an update may bring or change a logo.
  const cache = "private, max-age=300";
  if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(pluginId))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": cache },
    });
  const row = await db.plugin.findFirst({
    where: { pluginId, status: "active" },
    select: { id: true, manifest: true },
  });
  const logo = (row?.manifest as { logo?: unknown } | undefined)?.logo;
  const file =
    row && typeof logo === "string" && LOGO_FILE_RE.test(logo)
      ? await db.pluginFile.findUnique({
          where: { pluginRowId_name: { pluginRowId: row.id, name: logo } },
          select: { content: true },
        })
      : null;
  if (!file)
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": cache },
    });
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": String(logo).endsWith(".png")
        ? "image/png"
        : "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": cache,
    },
  });
}
