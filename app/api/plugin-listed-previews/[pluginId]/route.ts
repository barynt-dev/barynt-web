import { listedPreview } from "@/features/plugins/directory";
import { hasPermission, PLATFORM } from "@/lib/permissions";
import { getSession } from "@/lib/session";

/**
 * The first screenshot of a plugin that isn't installed (BARY-237) — what a
 * featured card shows. From the release the store starts on, checked
 * against the directory's hash and its file signature like an install
 * would; only for people who may install plugins, because it makes Barynt
 * load the release from its host. A 404 without a screenshot, which the
 * card falls back on.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pluginId: string }> },
) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { pluginId } = await params;
  // Briefly cached either way: a new release may bring a new screenshot.
  const cache = "private, max-age=300";
  const none = () =>
    new Response(null, { status: 404, headers: { "Cache-Control": cache } });
  if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(pluginId)) return none();
  if (!(await hasPermission("plugin.manage", PLATFORM))) return none();
  const preview = await listedPreview(pluginId);
  if (!preview) return none();
  return new Response(new Uint8Array(preview.content), {
    headers: {
      "Content-Type": preview.file.endsWith(".png")
        ? "image/png"
        : "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": cache,
    },
  });
}
