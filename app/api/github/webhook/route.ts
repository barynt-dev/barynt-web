import { receiveGitHubApp } from "@/features/github/webhook";

// The GitHub App's webhook (BARY-238) — one address for the whole instance,
// signed with the app's secret (`features/github/webhook.ts`).

export async function POST(req: Request) {
  return receiveGitHubApp(req);
}
