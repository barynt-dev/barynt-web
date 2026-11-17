// Runs once when a server starts (Next.js `register`). Background work that
// belongs to the server itself, not to a request: retrying webhook
// deliveries (BARY-211). Node only — the edge runtime has no database.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDeliveryWorker } = await import("./lib/webhooks/worker");
  startDeliveryWorker();
}
