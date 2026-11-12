import { NextResponse } from "next/server";
import { callBridge } from "@/features/plugins/runtime";
import { getSession } from "@/lib/session";

const ID = /^[\w-]{1,64}$/;

/**
 * A sandboxed plugin's request, forwarded by its host frame (BARY-144):
 * `{ plugin, workspace, project, method, params }`. The host page sends it
 * — never the plugin, which has no network — and every check runs here
 * (`callBridge`). Same-origin JSON only, so another site can't send one in
 * someone's name.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json(null, { status: 401 });
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin")
    return NextResponse.json(null, { status: 403 });
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json(null, { status: 415 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const pluginId = body?.plugin;
  const workspaceId = body?.workspace;
  const projectId = body?.project ?? null;
  if (
    typeof pluginId !== "string" ||
    typeof workspaceId !== "string" ||
    !ID.test(pluginId) ||
    !ID.test(workspaceId) ||
    (projectId !== null &&
      (typeof projectId !== "string" || !ID.test(projectId)))
  )
    return NextResponse.json(null, { status: 400 });

  const result = await callBridge(
    session.userId,
    { pluginId, workspaceId, projectId: projectId as string | null },
    body?.method,
    body?.params,
  );
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
