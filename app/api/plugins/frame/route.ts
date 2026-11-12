import { getPluginFrame } from "@/features/plugins/runtime";
import { getSession } from "@/lib/session";

const ID = /^[\w-]{1,64}$/;

/**
 * The document a sandboxed plugin's frame loads (BARY-144):
 * `?plugin=<id>&workspace=<id>&project=<id>&view=<viewId>`. Only where the
 * plugin is on for this person and fills that view; its CSP turns the
 * document into a sandbox with an opaque origin and no network
 * (`lib/plugins/frame.ts`). Never cached: it's checked on every load.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const url = new URL(req.url);
  const pluginId = url.searchParams.get("plugin") ?? "";
  const workspaceId = url.searchParams.get("workspace") ?? "";
  const projectId = url.searchParams.get("project") || null;
  const view = url.searchParams.get("view") ?? "";
  if (
    ![pluginId, workspaceId, view].every((v) => ID.test(v)) ||
    (projectId !== null && !ID.test(projectId))
  )
    return new Response(null, { status: 404 });

  const frame = await getPluginFrame(
    session.userId,
    { pluginId, workspaceId, projectId },
    { kind: "projectView", id: view },
  );
  if (!frame) return new Response(null, { status: 404 });
  return new Response(frame.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": frame.csp,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
