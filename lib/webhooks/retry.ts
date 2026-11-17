// When a failed delivery is tried again, when Barynt gives up, and when it
// turns a webhook off (BARY-211). No dependencies.

/** The wait before each retry: after the 1st attempt 1 minute, … after the
 *  5th 6 hours. Six attempts in all, spread over about nine hours. */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** A webhook that has failed every attempt for this long is turned off. */
export const DISABLE_AFTER_MS = 24 * 60 * 60_000;

/** How long deliveries stay in the log. */
export const LOG_RETENTION_MS = 7 * 24 * 60 * 60_000;

/** Per attempt. */
export const DELIVERY_TIMEOUT_MS = 10_000;

/** How much of a receiver's answer the log keeps. */
export const RESPONSE_KEEP_BYTES = 2048;

/** What came of one attempt: an HTTP status, or no answer at all. */
export type AttemptOutcome =
  | { status: number }
  | { error: "blocked" | "timeout" | "failed"; message: string };

export function succeeded(outcome: AttemptOutcome): boolean {
  return "status" in outcome && outcome.status >= 200 && outcome.status < 300;
}

/**
 * Whether another attempt could help. A receiver that says "no" (4xx) means
 * it — except for a timeout, a conflict or too many requests. A redirect is
 * no answer to follow, and a blocked address doesn't unblock itself.
 */
export function retryable(outcome: AttemptOutcome): boolean {
  if ("error" in outcome) return outcome.error !== "blocked";
  const { status } = outcome;
  if (status >= 500) return true;
  return status === 408 || status === 409 || status === 429;
}

/** When the next attempt is due after `attempts` failed ones — `null` when
 *  there is none. */
export function nextAttemptAt(
  attempts: number,
  outcome: AttemptOutcome,
  now: Date,
): Date | null {
  if (succeeded(outcome) || !retryable(outcome)) return null;
  const delay = RETRY_DELAYS_MS[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay);
}

/** Whether a webhook failing since `since` should be turned off now. */
export function shouldDisable(since: Date | null, now: Date): boolean {
  return since !== null && now.getTime() - since.getTime() >= DISABLE_AFTER_MS;
}

/** Hosts (`name` or `name:port`) an admin let webhooks reach although they
 *  are on a private network — an n8n in the company network
 *  (`WEBHOOK_INTERNAL_HOSTS`). */
export function webhookInternalHosts(
  value = process.env.WEBHOOK_INTERNAL_HOSTS,
): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+(:\d{1,5})?$/.test(h));
}
