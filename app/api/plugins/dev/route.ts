import { NextResponse } from "next/server";
import { devFingerprints } from "@/features/plugins/dev";
import { currentUserId } from "@/lib/permissions";
import { pluginDevSources } from "@/lib/plugins/dev";

// Plugins in development (BARY-221): each one's fingerprint, read again
// from its folder now — open frames poll this and reload when it changes
// (`useDevReload`). Gone in production and without `PLUGIN_DEV_DIRS`.
export async function GET() {
  if (pluginDevSources().length === 0)
    return new Response(null, { status: 404 });
  if (!(await currentUserId())) return new Response(null, { status: 401 });
  return NextResponse.json(await devFingerprints(), {
    headers: { "Cache-Control": "no-store" },
  });
}
