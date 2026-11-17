import "server-only";
import {
  attemptDelivery,
  claimDueDeliveries,
  pruneDeliveries,
} from "./deliver";

// Retries failed deliveries in the background (BARY-211). Started once per
// server from `instrumentation.ts`. Every instance runs one; they share the
// work through the database (`claimDueDeliveries` skips rows another holds),
// so nothing goes out twice. A fresh event doesn't wait for this — it's
// tried right away; this only picks up what's due again.

const TICK_MS = 15_000;
const PRUNE_EVERY_MS = 60 * 60_000;

declare global {
  // eslint-disable-next-line no-var
  var webhookWorker: ReturnType<typeof setInterval> | undefined;
}

let running = false;
let lastPrune = 0;

/** One round: everything due, in batches, then the old log entries. */
export async function runDueDeliveries(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const ids = await claimDueDeliveries();
      if (ids.length === 0) break;
      await Promise.all(ids.map(attemptDelivery));
    }
    if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
      lastPrune = Date.now();
      await pruneDeliveries();
    }
  } catch (error) {
    console.error("[webhooks] worker round failed:", error);
  } finally {
    running = false;
  }
}

export function startDeliveryWorker(): void {
  if (process.env.WEBHOOK_WORKER === "false") return;
  // Hot reload in development loads this again; one timer is enough.
  if (globalThis.webhookWorker) clearInterval(globalThis.webhookWorker);
  globalThis.webhookWorker = setInterval(runDueDeliveries, TICK_MS);
  globalThis.webhookWorker.unref?.();
}
