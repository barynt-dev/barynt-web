import { db } from "@/lib/db";
import { PREVIEW_FILE_RE } from "@/lib/plugins/manifest";
import { getSession } from "@/lib/session";

/**
 * A preview image of an installed plugin version (BARY-199). It came with
 * the release, checked against the directory's hash and its file signature,
 * and is stored with the version — the browser never loads it from the
 * plugin's Git host. Signed-in people only; a version's files never change,
 * so the answer is cacheable for good.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { id, file } = await params;
  if (!PREVIEW_FILE_RE.test(file) || !/^[\w-]{1,64}$/.test(id))
    return new Response(null, { status: 404 });
  const row = await db.pluginFile.findUnique({
    where: { pluginRowId_name: { pluginRowId: id, name: file } },
    select: { content: true },
  });
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": file.endsWith(".png") ? "image/png" : "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
