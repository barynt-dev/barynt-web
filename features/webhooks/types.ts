import type { WebhookEvent } from "@/lib/webhooks/events";

/** A workspace's webhook endpoint. Never carries the secret — that's only
 *  ever returned once, at creation (`createWebhook`). */
export interface WebhookRow {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: Date;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: number | null;
  lastDeliveryError: string | null;
  /** Set when Barynt turned it off after a day of failed deliveries. */
  autoDisabledAt: Date | null;
}

/** One delivery in a webhook's log (BARY-211). */
export interface WebhookDelivery {
  id: string;
  event: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  /** When the next try is due — only while it's pending. */
  nextAttemptAt: Date | null;
  lastStatus: number | null;
  lastError: string | null;
  /** The start of the receiver's answer. */
  lastResponse: string | null;
  lastDurationMs: number | null;
  /** The body as sent. */
  payload: string;
}

export interface WebhooksView {
  webhooks: WebhookRow[];
}
