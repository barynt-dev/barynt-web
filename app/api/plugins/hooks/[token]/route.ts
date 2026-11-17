import { receiveInbound } from "@/features/plugins/inbound";

// Webhooks another service (GitLab, GitHub) sends a plugin through Barynt
// (BARY-215). No session, no API key: the unguessable address finds the
// hook, the provider's signature or token proves the call
// (`features/plugins/inbound.ts`).

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return receiveInbound(token, req);
}
