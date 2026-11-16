// What the delivery log shows of a delivery (BARY-211) — for a webhook's
// and for a plugin's server (BARY-212).

export const DELIVERY_SELECT = {
  id: true,
  event: true,
  status: true,
  attempts: true,
  createdAt: true,
  updatedAt: true,
  nextAttemptAt: true,
  lastStatus: true,
  lastError: true,
  lastResponse: true,
  lastDurationMs: true,
  payload: true,
} as const;
