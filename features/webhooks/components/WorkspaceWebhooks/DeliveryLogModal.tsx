"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { SheetHeader } from "@/components/ui/layout/Modal/components/SheetHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import {
  listWebhookDeliveries,
  resendWebhookDelivery,
} from "@/features/webhooks/actions";
import type { WebhookDelivery } from "@/features/webhooks/types";
import { useSwipeToClose } from "@/lib/utils/useSwipeToClose";
import styles from "./deliveryLog.module.scss";

interface DeliveryLogModalProps {
  webhookId: string;
  url: string;
  close: () => void;
  /** A bottom sheet (phone) instead of a dialog. */
  sheet?: boolean;
}

/** What the list says about a body: pretty JSON when it is JSON. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/**
 * A webhook's latest deliveries (BARY-211): what went out, what came back,
 * whether Barynt will try again — and a way to send one again. Loaded when
 * the window opens; the log lives in `EventDelivery`.
 */
export function DeliveryLogModal({
  webhookId,
  url,
  close,
  sheet,
}: DeliveryLogModalProps) {
  const t = useTranslations();
  const format = useFormatter();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeToClose(close, bodyRef);

  useEffect(() => {
    let live = true;
    listWebhookDeliveries(webhookId).then((rows) => {
      if (live) setDeliveries(rows);
    });
    return () => {
      live = false;
    };
  }, [webhookId]);

  const resend = (id: string) =>
    startTransition(async () => {
      const row = await resendWebhookDelivery(id);
      if (row)
        setDeliveries(
          (list) => list?.map((d) => (d.id === id ? row : d)) ?? null,
        );
    });

  const title = t("webhooks.log.title");
  const statusOf = (d: WebhookDelivery) =>
    d.status === "SUCCEEDED"
      ? { tone: "ok", label: t("webhooks.log.delivered") }
      : d.status === "PENDING"
        ? {
            tone: "pending",
            label: d.nextAttemptAt
              ? t("webhooks.log.retryAt", {
                  time: format.dateTime(d.nextAttemptAt, {
                    timeStyle: "short",
                  }),
                })
              : t("webhooks.log.sending"),
          }
        : { tone: "failed", label: t("webhooks.log.gaveUp") };

  return (
    <Modal
      variant={sheet ? "sheet" : "dialog"}
      width={760}
      style={sheet ? swipe.style : undefined}
      {...(sheet ? swipe.handlers : {})}
    >
      {sheet ? (
        <SheetHeader
          title={title}
          onClose={close}
          closeLabel={t("actions.close")}
        />
      ) : (
        <ModalHeader
          title={title}
          onClose={close}
          closeLabel={t("actions.close")}
        />
      )}

      <ModalBody ref={bodyRef} className={styles.body}>
        <p className={styles.url}>{url}</p>

        {deliveries === null ? (
          <p className={styles.empty}>{t("webhooks.log.loading")}</p>
        ) : deliveries.length === 0 ? (
          <p className={styles.empty}>{t("webhooks.log.empty")}</p>
        ) : (
          <ul className={styles.list}>
            {deliveries.map((d) => {
              const status = statusOf(d);
              const expanded = open === d.id;
              return (
                <li key={d.id} className={styles.item} data-tone={status.tone}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : d.id)}
                  >
                    <span className={styles.dot} aria-hidden />
                    <code className={styles.event}>{d.event}</code>
                    <span className={styles.state}>{status.label}</span>
                    <span className={styles.result}>
                      {d.lastStatus !== null ? (
                        <Badge size="sm" mono active={d.lastStatus < 300}>
                          {d.lastStatus}
                        </Badge>
                      ) : d.lastError ? (
                        <Badge size="sm" mono={false}>
                          {t("webhooks.deliveryError")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className={styles.time}>
                      {format.dateTime(d.createdAt, {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </span>
                    <Icon
                      icon="lucide:chevron-down"
                      width={14}
                      className={styles.chevron}
                    />
                  </button>

                  {expanded && (
                    <div className={styles.detail}>
                      <dl className={styles.facts}>
                        <dt>{t("webhooks.log.attempts")}</dt>
                        <dd>{d.attempts}</dd>
                        {d.lastDurationMs !== null && (
                          <>
                            <dt>{t("webhooks.log.duration")}</dt>
                            <dd>{d.lastDurationMs} ms</dd>
                          </>
                        )}
                        <dt>{t("webhooks.log.id")}</dt>
                        <dd>
                          <code>{d.id}</code>
                        </dd>
                        {d.lastError && (
                          <>
                            <dt>{t("webhooks.log.error")}</dt>
                            <dd>{d.lastError}</dd>
                          </>
                        )}
                      </dl>
                      {d.lastResponse && (
                        <>
                          <span className={styles.label}>
                            {t("webhooks.log.response")}
                          </span>
                          <pre className={styles.code}>
                            {pretty(d.lastResponse)}
                          </pre>
                        </>
                      )}
                      <span className={styles.label}>
                        {t("webhooks.log.payload")}
                      </span>
                      <pre className={styles.code}>{pretty(d.payload)}</pre>
                      <div className={styles.actions}>
                        <Button
                          size="sm"
                          icon={<Icon icon="lucide:send" width={14} />}
                          disabled={isPending}
                          onClick={() => resend(d.id)}
                        >
                          {t("webhooks.log.resend")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
    </Modal>
  );
}
